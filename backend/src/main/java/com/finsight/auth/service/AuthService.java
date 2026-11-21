package com.finsight.auth.service;

import com.finsight.auth.api.AuthException;
import com.finsight.auth.api.OtpSendRequest;
import com.finsight.auth.api.OtpVerifyRequest;
import com.finsight.auth.model.AuthSession;
import com.finsight.auth.model.OtpChallenge;
import com.finsight.auth.model.UserAccount;
import com.finsight.auth.repository.AuthSessionRepository;
import com.finsight.auth.repository.OtpChallengeRepository;
import com.finsight.auth.repository.UserAccountRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Optional;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
    private static final Duration OTP_LIFETIME = Duration.ofMinutes(10);
    private static final Duration OTP_RESEND_DELAY = Duration.ofSeconds(60);
    private static final Duration SESSION_LIFETIME = Duration.ofDays(365);
    private static final int OTP_MAX_ATTEMPTS = 5;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final OtpChallengeRepository challenges;
    private final UserAccountRepository users;
    private final AuthSessionRepository sessions;
    private final OtpDeliveryService delivery;
    private final String otpSecret;

    public AuthService(
        OtpChallengeRepository challenges,
        UserAccountRepository users,
        AuthSessionRepository sessions,
        OtpDeliveryService delivery,
        @Value("${finsight.otp.secret}") String otpSecret
    ) {
        if (otpSecret == null || otpSecret.length() < 32) {
            throw new IllegalStateException("OTP_SECRET must contain at least 32 characters.");
        }
        this.challenges = challenges;
        this.users = users;
        this.sessions = sessions;
        this.delivery = delivery;
        this.otpSecret = otpSecret;
    }

    @Transactional(noRollbackFor = AuthException.class)
    public OtpSent sendOtp(OtpSendRequest request) {
        Recipient recipient = resolveRecipient(request.channel(), request.email(), request.phone());
        String challengeKey = challengeKey(recipient.channel(), recipient.destination());
        Instant now = Instant.now();
        Optional<OtpChallenge> previous = challenges.findForUpdate(challengeKey);
        if (previous.isPresent() && previous.get().getResendAt().isAfter(now)) {
            long seconds = Math.max(1, Duration.between(now, previous.get().getResendAt()).toSeconds() + 1);
            throw new AuthException(
                HttpStatus.TOO_MANY_REQUESTS,
                "Please wait before requesting another code.",
                seconds
            );
        }

        String code = String.format("%06d", RANDOM.nextInt(1_000_000));
        delivery.send(recipient.channel(), recipient.destination(), code);
        OtpChallenge challenge = new OtpChallenge(
            challengeKey,
            recipient.channel(),
            recipient.destination(),
            hashOtp(challengeKey, code),
            now.plus(OTP_LIFETIME),
            now.plus(OTP_RESEND_DELAY)
        );
        challenges.save(challenge);
        return new OtpSent(
            recipient.channel(),
            OTP_LIFETIME.toSeconds(),
            OTP_RESEND_DELAY.toSeconds()
        );
    }

    @Transactional(noRollbackFor = AuthException.class)
    public LoginResult verifyOtp(OtpVerifyRequest request) {
        Recipient recipient = resolveRecipient(request.channel(), request.email(), request.phone());
        String code = request.code() == null ? "" : request.code().trim();
        if (!code.matches("\\d{6}")) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "Enter the 6-digit verification code.");
        }
        String displayName = normalizeDisplayName(request.displayName());
        String challengeKey = challengeKey(recipient.channel(), recipient.destination());
        Instant now = Instant.now();
        OtpChallenge challenge = challenges.findForUpdate(challengeKey)
            .orElseThrow(() -> expiredCode());

        if (!challenge.getExpiresAt().isAfter(now)) {
            challenges.delete(challenge);
            throw expiredCode();
        }

        byte[] expected = challenge.getCodeHash().getBytes(StandardCharsets.US_ASCII);
        byte[] actual = hashOtp(challengeKey, code).getBytes(StandardCharsets.US_ASCII);
        if (!MessageDigest.isEqual(expected, actual)) {
            int attempts = challenge.recordFailedAttempt();
            if (attempts >= OTP_MAX_ATTEMPTS) {
                challenges.delete(challenge);
                throw new AuthException(
                    HttpStatus.BAD_REQUEST,
                    "Too many incorrect attempts. Request a new code."
                );
            }
            throw new AuthException(HttpStatus.BAD_REQUEST, "That verification code is incorrect.");
        }

        challenges.delete(challenge);
        return createLoginSession(recipient, displayName, now);
    }

    @Transactional
    public LoginResult createDemoSession(
        String channelValue,
        String emailValue,
        String phoneValue,
        String displayNameValue
    ) {
        String channel = channelValue == null ? "email" : channelValue.trim().toLowerCase(Locale.ROOT);
        if (!channel.equals("email") && !channel.equals("sms")) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "Choose email or SMS.");
        }

        String destinationValue = channel.equals("email") ? emailValue : phoneValue;
        String destination = destinationValue == null ? "" : destinationValue.trim();
        if (destination.isEmpty() || destination.length() > 254) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "Enter a value for your email or phone.");
        }
        if (channel.equals("email")) {
            destination = destination.toLowerCase(Locale.ROOT);
        }

        String displayName = normalizeDisplayName(displayNameValue);
        return createLoginSession(new Recipient(channel, destination), displayName, Instant.now());
    }

    @Transactional(readOnly = true)
    public Optional<SessionInfo> getSession(String token) {
        if (token == null || token.length() > 128) {
            return Optional.empty();
        }
        Instant now = Instant.now();
        return sessions.findByTokenHashAndExpiresAtAfter(hashSessionToken(token), now)
            .flatMap(session -> users.findById(session.getUserId()))
            .map(user -> new SessionInfo(
                user.getId(),
                user.getChannel(),
                user.getDestination(),
                user.getDisplayName()
            ));
    }

    @Transactional
    public void logout(String token) {
        if (token != null && !token.isBlank() && token.length() <= 128) {
            sessions.deleteByTokenHash(hashSessionToken(token));
        }
    }

    private Recipient resolveRecipient(String channelValue, String emailValue, String phoneValue) {
        String channel = channelValue == null ? "email" : channelValue.trim().toLowerCase(Locale.ROOT);
        if (!channel.equals("email") && !channel.equals("sms")) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "Choose email or SMS verification.");
        }

        if (channel.equals("email")) {
            String email = emailValue == null ? "" : emailValue.trim().toLowerCase(Locale.ROOT);
            if (email.length() > 254 || !email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) {
                throw new AuthException(HttpStatus.BAD_REQUEST, "Enter a valid email address.");
            }
            return new Recipient(channel, email);
        }

        String phone = phoneValue == null ? "" : phoneValue.trim();
        if (!phone.matches("^\\+[1-9]\\d{7,14}$")) {
            throw new AuthException(
                HttpStatus.BAD_REQUEST,
                "Enter a valid phone number in international format, such as +14155550123."
            );
        }
        return new Recipient(channel, phone);
    }

    private String normalizeDisplayName(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String name = value.trim();
        if (name.length() > 120) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "Name must be 120 characters or fewer.");
        }
        return name;
    }

    private String hashOtp(String challengeKey, String code) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(otpSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(
                mac.doFinal((challengeKey + ":" + code).getBytes(StandardCharsets.UTF_8))
            );
        } catch (java.security.GeneralSecurityException exception) {
            throw new IllegalStateException("Could not hash the OTP.", exception);
        }
    }

    private String newSessionToken() {
        byte[] token = new byte[32];
        RANDOM.nextBytes(token);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(token);
    }

    private LoginResult createLoginSession(Recipient recipient, String displayName, Instant now) {
        UserAccount user = users.findByChannelAndDestination(recipient.channel(), recipient.destination())
            .orElseGet(() -> new UserAccount(
                recipient.channel(),
                recipient.destination(),
                displayName,
                now
            ));
        if (user.getId() != null) {
            user.recordLogin(displayName, now);
        }
        user = users.save(user);

        String token = newSessionToken();
        sessions.save(new AuthSession(
            hashSessionToken(token),
            user.getId(),
            now.plus(SESSION_LIFETIME),
            now
        ));
        return new LoginResult(
            token,
            recipient.channel(),
            recipient.destination(),
            user.getDisplayName()
        );
    }

    private String hashSessionToken(String token) {
        try {
            return HexFormat.of().formatHex(
                MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8))
            );
        } catch (java.security.NoSuchAlgorithmException exception) {
            throw new IllegalStateException("Could not hash the session token.", exception);
        }
    }

    private String challengeKey(String channel, String destination) {
        return channel + ":" + destination;
    }

    private AuthException expiredCode() {
        return new AuthException(HttpStatus.BAD_REQUEST, "This code has expired. Request a new code.");
    }

    private record Recipient(String channel, String destination) {}

    public record OtpSent(String channel, long expiresInSeconds, long resendAfterSeconds) {}

    public record LoginResult(String token, String channel, String destination, String displayName) {}

    public record SessionInfo(Long userId, String channel, String destination, String displayName) {}
}
