package com.finsight.auth.service;
// Implements account registration, authentication, OTP, password, and profile rules.

import com.finsight.auth.api.AuthException;
import com.finsight.auth.api.PasswordChangeRequest;
import com.finsight.auth.api.PasswordLoginRequest;
import com.finsight.auth.api.PasswordRegisterRequest;
import com.finsight.auth.api.PasswordResetRequest;
import com.finsight.auth.api.ProfileUpdateRequest;
import com.finsight.auth.api.OtpSendRequest;
import com.finsight.auth.api.OtpVerifyRequest;
import com.finsight.auth.model.AuthHistory;
import com.finsight.auth.model.AuthSession;
import com.finsight.auth.model.OtpChallenge;
import com.finsight.auth.model.UserAccount;
import com.finsight.auth.repository.AuthHistoryRepository;
import com.finsight.auth.repository.AuthSessionRepository;
import com.finsight.auth.repository.FinanceAccountRepository;
import com.finsight.auth.repository.FinanceTransactionRepository;
import com.finsight.auth.repository.MonthlyBudgetRepository;
import com.finsight.auth.repository.OtpChallengeRepository;
import com.finsight.auth.repository.UserAccountRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
    private static final Duration OTP_LIFETIME = Duration.ofMinutes(10);
    private static final Duration OTP_RESEND_DELAY = Duration.ofSeconds(60);
    private static final Duration SESSION_LIFETIME = Duration.ofDays(365);
    private static final int OTP_MAX_ATTEMPTS = 5;
    private static final int PASSWORD_MAX_BYTES = 72;
    private static final Set<String> SAVINGS_GOALS = Set.of(
        "Build an emergency fund",
        "Save for a home",
        "Pay off debt",
        "Grow investments",
        "Plan a trip",
        "Save for education"
    );
    private static final SecureRandom RANDOM = new SecureRandom();

    private final OtpChallengeRepository challenges;
    private final AuthHistoryRepository history;
    private final UserAccountRepository users;
    private final AuthSessionRepository sessions;
    private final FinanceTransactionRepository transactions;
    private final FinanceAccountRepository accounts;
    private final MonthlyBudgetRepository budgets;
    private final OtpDeliveryService delivery;
    private final PasswordEncoder passwordEncoder;
    private final String otpSecret;
    private final String dummyPasswordHash;

    public AuthService(
        OtpChallengeRepository challenges,
        AuthHistoryRepository history,
        UserAccountRepository users,
        AuthSessionRepository sessions,
        FinanceTransactionRepository transactions,
        FinanceAccountRepository accounts,
        MonthlyBudgetRepository budgets,
        OtpDeliveryService delivery,
        PasswordEncoder passwordEncoder,
        @Value("${finsight.otp.secret}") String otpSecret
    ) {
        if (otpSecret == null || otpSecret.length() < 32) {
            throw new IllegalStateException("OTP_SECRET must contain at least 32 characters.");
        }
        this.challenges = challenges;
        this.history = history;
        this.users = users;
        this.sessions = sessions;
        this.transactions = transactions;
        this.accounts = accounts;
        this.budgets = budgets;
        this.delivery = delivery;
        this.passwordEncoder = passwordEncoder;
        this.otpSecret = otpSecret;
        this.dummyPasswordHash = passwordEncoder.encode("finsight-password-timing-placeholder");
    }

    @Transactional(noRollbackFor = AuthException.class)
    public OtpSent sendOtp(OtpSendRequest request) {
        if (request == null) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "Enter an email or mobile number.");
        }
        Recipient recipient = resolveRecipient(request.channel(), request.email(), request.phone());
        String key = challengeKey(recipient.channel(), recipient.destination());
        if (recipient.channel().equals("sms")) {
            String flow = normalizeOtpFlow(request.flow());
            String displayName = normalizeDisplayName(request.displayName());
            Optional<UserAccount> existing = users.findByChannelAndDestination(
                recipient.channel(),
                recipient.destination()
            );
            if (flow.equals("signup")) {
                if (displayName == null) {
                    throw new AuthException(HttpStatus.BAD_REQUEST, "Enter your name to create an account.");
                }
                if (existing.isPresent()) {
                    throw new AuthException(
                        HttpStatus.CONFLICT,
                        "An account with this mobile number already exists. Sign in instead."
                    );
                }
            } else if (existing.isEmpty()) {
                throw new AuthException(HttpStatus.NOT_FOUND, "No account exists for this mobile number. Sign up first.");
            }
            key = smsChallengeKey(flow, recipient);
        }
        return sendOtp(recipient, key);
    }

    @Transactional(noRollbackFor = AuthException.class)
    public void sendPasswordResetOtp(OtpSendRequest request) {
        Recipient recipient = resolveEmailOtpRecipient(request.channel(), request.email());
        if (users.findByChannelAndDestination(recipient.channel(), recipient.destination()).isEmpty()) {
            return;
        }
        sendOtp(recipient, passwordResetChallengeKey(recipient));
    }

    private OtpSent sendOtp(Recipient recipient, String challengeKey) {
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
        if (request == null) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "Enter the verification code.");
        }
        Recipient recipient = resolveRecipient(request.channel(), request.email(), request.phone());
        String displayName = normalizeDisplayName(request.displayName());
        String flow = null;
        String key = challengeKey(recipient.channel(), recipient.destination());
        if (recipient.channel().equals("sms")) {
            flow = normalizeOtpFlow(request.flow());
            if (flow.equals("signup") && displayName == null) {
                throw new AuthException(HttpStatus.BAD_REQUEST, "Enter your name to create an account.");
            }
            key = smsChallengeKey(flow, recipient);
        }
        String password = request.password() == null || request.password().isBlank()
            ? null
            : validateNewPassword(request.password());
        verifyAndConsumeOtp(key, request.code());
        if (recipient.channel().equals("sms")) {
            Optional<UserAccount> existing = users.findByChannelAndDestination(
                recipient.channel(),
                recipient.destination()
            );
            if (flow.equals("signup") && existing.isPresent()) {
                throw new AuthException(
                    HttpStatus.CONFLICT,
                    "An account with this mobile number already exists. Sign in instead."
                );
            }
            if (flow.equals("login") && existing.isEmpty()) {
                throw new AuthException(HttpStatus.NOT_FOUND, "No account exists for this mobile number. Sign up first.");
            }
        }
        return createLoginSession(recipient, displayName, Instant.now(), password);
    }

    @Transactional(noRollbackFor = AuthException.class)
    public void resetPassword(PasswordResetRequest request) {
        Recipient recipient = resolveEmailOtpRecipient(request.channel(), request.email());
        String newPassword = validateNewPassword(request.newPassword());
        String resetChallengeKey = passwordResetChallengeKey(recipient);
        verifyAndConsumeOtp(resetChallengeKey, request.code());
        UserAccount user = users.findByChannelAndDestination(recipient.channel(), recipient.destination())
            .orElseThrow(() -> new AuthException(HttpStatus.BAD_REQUEST, "The reset code or account is not valid."));
        if (user.getPasswordHash() != null && passwordEncoder.matches(newPassword, user.getPasswordHash())) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "Choose a password different from your current password.");
        }
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        users.save(user);
    }

    @Transactional
    public LoginResult passwordRegister(PasswordRegisterRequest request) {
        if (request == null) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "Account details are required.");
        }
        Recipient recipient = resolveRecipient(request.channel(), request.email(), request.phone());
        rejectSmsPasswordAuth(recipient);
        String displayName = normalizeDisplayName(request.displayName());
        if (displayName == null) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "Enter a display name.");
        }
        String password = validateNewPassword(request.password());
        if (users.findByChannelAndDestination(recipient.channel(), recipient.destination()).isPresent()) {
            throw new AuthException(
                HttpStatus.CONFLICT,
                "An account with this email or mobile number already exists. Sign in instead."
            );
        }

        Instant now = Instant.now();
        UserAccount user = new UserAccount(
            recipient.channel(),
            recipient.destination(),
            displayName,
            now
        );
        user.setPasswordHash(passwordEncoder.encode(password));
        return createSession(users.save(user), now);
    }

    @Transactional(noRollbackFor = AuthException.class)
    public LoginResult passwordLogin(PasswordLoginRequest request) {
        Recipient recipient = resolveRecipient(request.channel(), request.email(), request.phone());
        rejectSmsPasswordAuth(recipient);
        String password = request.password() == null ? "" : request.password();
        Optional<UserAccount> candidate = users.findByChannelAndDestination(recipient.channel(), recipient.destination());
        Instant now = Instant.now();

        if (candidate.isEmpty()) {
            verifyAgainstDummyHash(password);
            throw invalidPasswordLogin();
        }

        UserAccount user = candidate.get();
        String passwordHash = user.getPasswordHash();
        if (passwordHash == null) {
            verifyAgainstDummyHash(password);
            user.recordFailedPasswordAttempt(now);
            users.save(user);
            throw invalidPasswordLogin();
        }
        if (user.isPasswordLocked(now)) {
            verifyAgainstDummyHash(password);
            throw invalidPasswordLogin();
        }
        if (password.getBytes(StandardCharsets.UTF_8).length > PASSWORD_MAX_BYTES
            || !passwordEncoder.matches(password, passwordHash)) {
            user.recordFailedPasswordAttempt(now);
            users.save(user);
            throw invalidPasswordLogin();
        }

        user.resetPasswordFailures();
        users.save(user);
        return createLoginSession(recipient, user.getDisplayName(), now);
    }

    @Transactional
    public LoginResult loginWithGoogle(String email, String displayName) {
        String normalizedEmail = email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
        if (normalizedEmail.length() > 254
            || !normalizedEmail.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) {
            throw new AuthException(HttpStatus.UNAUTHORIZED, "Google did not provide a valid email address.");
        }
        return createLoginSession(
            new Recipient("email", normalizedEmail),
            normalizeDisplayName(displayName),
            Instant.now()
        );
    }

    @Transactional
    public ProfileInfo getProfile(String token) {
        return profileInfo(requireCurrentUser(token));
    }

    @Transactional
    public ProfileInfo updateProfile(String token, ProfileUpdateRequest request) {
        UserAccount user = requireCurrentUser(token);
        if (request == null) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "Profile details are required.");
        }
        String displayName = normalizeDisplayName(request.displayName());
        if (displayName == null) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "Enter a display name.");
        }
        Integer age = request.age();
        if (age != null && (age < 1 || age > 120)) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "Age must be between 1 and 120.");
        }
        String gender = normalizeOptionalProfileText(request.gender(), 40, "Gender");
        String mobileNumber = normalizeOptionalProfileText(request.mobileNumber(), 30, "Mobile number");
        if (mobileNumber != null && !mobileNumber.matches("[+0-9() .-]{6,30}")) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "Enter a valid mobile number.");
        }
        String address = normalizeOptionalProfileText(request.address(), 500, "Address");
        BigDecimal monthlyIncome = normalizeMonthlyIncome(request.monthlyIncome());
        String occupation = normalizeOptionalProfileText(request.occupation(), 100, "Occupation");
        String currency = normalizeOptionalProfileText(request.currency(), 3, "Currency");
        if (currency != null && !currency.equals("INR")) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "Only INR is currently supported.");
        }
        String savingsGoals = request.savingsGoals() == null
            ? null
            : normalizeSavingsGoals(request.savingsGoals());
        user.updateDisplayName(displayName);
        user.updateProfile(age, gender, mobileNumber, address);
        user.updateFinancialProfile(monthlyIncome, occupation, currency, savingsGoals);
        users.save(user);
        return profileInfo(user);
    }

    private BigDecimal normalizeMonthlyIncome(BigDecimal monthlyIncome) {
        if (monthlyIncome == null) {
            return null;
        }
        BigDecimal normalized;
        try {
            normalized = monthlyIncome.setScale(2, RoundingMode.UNNECESSARY);
        } catch (ArithmeticException exception) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "Monthly income can have no more than 2 decimal places.");
        }
        if (normalized.signum() < 0 || normalized.precision() > 19) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "Enter a valid monthly income in INR.");
        }
        return normalized;
    }

    private String normalizeSavingsGoals(List<String> savingsGoals) {
        if (savingsGoals.size() > SAVINGS_GOALS.size()) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "Select up to 6 savings goals.");
        }
        LinkedHashSet<String> normalized = new LinkedHashSet<>();
        for (String goal : savingsGoals) {
            if (goal == null || !SAVINGS_GOALS.contains(goal)) {
                throw new AuthException(HttpStatus.BAD_REQUEST, "Choose savings goals from the available options.");
            }
            normalized.add(goal);
        }
        return String.join("|", normalized);
    }

    private String normalizeOptionalProfileText(String value, int maxLength, String label) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.length() > maxLength) {
            throw new AuthException(
                HttpStatus.BAD_REQUEST,
                label + " must be " + maxLength + " characters or fewer."
            );
        }
        return normalized.isEmpty() ? null : normalized;
    }

    private ProfileInfo profileInfo(UserAccount user) {
        return new ProfileInfo(
            user.getChannel(),
            user.getDestination(),
            user.getDisplayName(),
            user.getAge(),
            user.getGender(),
            user.getMobileNumber(),
            user.getAddress(),
            user.getMonthlyIncome(),
            user.getOccupation(),
            user.getCurrency(),
            user.getSavingsGoals() == null || user.getSavingsGoals().isBlank()
                ? List.of()
                : List.of(user.getSavingsGoals().split("\\|"))
        );
    }

    @Transactional
    public void changePassword(String token, PasswordChangeRequest request) {
        UserAccount user = requireCurrentUser(token);
        String newPassword = validateNewPassword(request.newPassword());
        String currentHash = user.getPasswordHash();
        if (currentHash != null && passwordEncoder.matches(newPassword, currentHash)) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "Choose a password different from your current password.");
        }
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        users.save(user);
    }

    private UserAccount requireCurrentUser(String token) {
        SessionInfo session = getSession(token)
            .orElseThrow(() -> new AuthException(HttpStatus.UNAUTHORIZED, "Please sign in to continue."));
        return users.findById(session.userId())
            .orElseThrow(() -> new AuthException(HttpStatus.UNAUTHORIZED, "Please sign in to continue."));
    }

    private void verifyAgainstDummyHash(String password) {
        String candidate = password.getBytes(StandardCharsets.UTF_8).length <= PASSWORD_MAX_BYTES ? password : "";
        passwordEncoder.matches(candidate, dummyPasswordHash);
    }

    private String validateNewPassword(String password) {
        if (password == null
            || password.length() < 8
            || password.getBytes(StandardCharsets.UTF_8).length > PASSWORD_MAX_BYTES) {
            throw new AuthException(
                HttpStatus.BAD_REQUEST,
                "Password must be at least 8 characters and no more than 72 UTF-8 bytes."
            );
        }
        return password;
    }

    private AuthException invalidPasswordLogin() {
        return new AuthException(HttpStatus.UNAUTHORIZED, "Email/phone or password is incorrect.");
    }

    private void verifyAndConsumeOtp(String challengeKey, String codeValue) {
        String code = codeValue == null ? "" : codeValue.trim();
        if (!code.matches("\\d{6}")) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "Enter the 6-digit verification code.");
        }
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
            throw new AuthException(HttpStatus.BAD_REQUEST, "Choose email or mobile number.");
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
            getSession(token).ifPresent(session ->
                history.save(new AuthHistory(session.userId(), "LOGOUT", Instant.now()))
            );
            sessions.deleteByTokenHash(hashSessionToken(token));
        }
    }

    @Transactional(readOnly = true)
    public List<AuthHistoryEntry> getAuthHistory(String token) {
        UserAccount user = requireCurrentUser(token);
        return history.findTop100ByUserIdOrderByOccurredAtDescIdDesc(user.getId())
            .stream()
            .map(entry -> new AuthHistoryEntry(entry.getEventType(), entry.getOccurredAt()))
            .toList();
    }

    @Transactional
    public void deleteAccount(String token) {
        UserAccount user = requireCurrentUser(token);
        Long userId = user.getId();
        transactions.deleteByUserId(userId);
        accounts.deleteByUserId(userId);
        budgets.deleteByUserId(userId);
        history.deleteByUserId(userId);
        sessions.deleteByUserId(userId);
        challenges.deleteByChannelAndDestination(user.getChannel(), user.getDestination());
        users.delete(user);
    }

    private Recipient resolveEmailOtpRecipient(String channelValue, String emailValue) {
        if (channelValue != null && !channelValue.trim().equalsIgnoreCase("email")) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "OTP verification is available by email only.");
        }
        return resolveRecipient("email", emailValue, null);
    }

    private void rejectSmsPasswordAuth(Recipient recipient) {
        if (recipient.channel().equals("sms")) {
            throw new AuthException(
                HttpStatus.BAD_REQUEST,
                "Phone sign-in and registration require a verification code."
            );
        }
    }

    private String normalizeOtpFlow(String flowValue) {
        String flow = flowValue == null ? "" : flowValue.trim().toLowerCase(Locale.ROOT);
        if (!flow.equals("login") && !flow.equals("signup")) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "Choose sign in or sign up before requesting a code.");
        }
        return flow;
    }

    private String smsChallengeKey(String flow, Recipient recipient) {
        return "s:" + flow + ":" + challengeKey(recipient.channel(), recipient.destination());
    }

    private Recipient resolveRecipient(String channelValue, String emailValue, String phoneValue) {
        String channel = channelValue == null ? "email" : channelValue.trim().toLowerCase(Locale.ROOT);
        if (!channel.equals("email") && !channel.equals("sms")) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "Choose email or mobile number.");
        }

        if (channel.equals("email")) {
            String email = emailValue == null ? "" : emailValue.trim().toLowerCase(Locale.ROOT);
            if (email.length() > 254 || !email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) {
                throw new AuthException(HttpStatus.BAD_REQUEST, "Enter a valid email address.");
            }
            return new Recipient(channel, email);
        }

        String phone = normalizePhone(phoneValue);
        if (!phone.matches("^\\+[1-9]\\d{7,14}$")) {
            throw new AuthException(
                HttpStatus.BAD_REQUEST,
                "Enter a valid 10-digit mobile number."
            );
        }
        return new Recipient(channel, phone);
    }

    private String normalizePhone(String phoneValue) {
        String phone = phoneValue == null ? "" : phoneValue.trim();
        if (phone.startsWith("+")) {
            return "+" + phone.substring(1).replaceAll("\\D", "");
        }

        String digits = phone.replaceAll("\\D", "");
        if (digits.length() == 10) {
            return "+91" + digits;
        }
        if (digits.length() == 12 && digits.startsWith("91")) {
            return "+" + digits;
        }
        return phone;
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
        return createLoginSession(recipient, displayName, now, null);
    }

    private LoginResult createLoginSession(Recipient recipient, String displayName, Instant now, String password) {
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
        user.resetPasswordFailures();
        if (password != null) {
            user.setPasswordHash(passwordEncoder.encode(password));
        }
        user = users.save(user);

        return createSession(user, now);
    }

    private LoginResult createSession(UserAccount user, Instant now) {
        String token = newSessionToken();
        sessions.save(new AuthSession(
            hashSessionToken(token),
            user.getId(),
            now.plus(SESSION_LIFETIME),
            now
        ));
        history.save(new AuthHistory(user.getId(), "LOGIN", now));
        return new LoginResult(
            token,
            user.getChannel(),
            user.getDestination(),
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

    private String passwordResetChallengeKey(Recipient recipient) {
        return "r:" + recipient.channel() + ":" + recipient.destination();
    }

    private AuthException expiredCode() {
        return new AuthException(HttpStatus.BAD_REQUEST, "This code has expired. Request a new code.");
    }

    private record Recipient(String channel, String destination) {}

    public record OtpSent(String channel, long expiresInSeconds, long resendAfterSeconds) {}

    public record LoginResult(String token, String channel, String destination, String displayName) {}

    public record SessionInfo(Long userId, String channel, String destination, String displayName) {}

    public record ProfileInfo(
        String channel,
        String destination,
        String displayName,
        Integer age,
        String gender,
        String mobileNumber,
        String address,
        BigDecimal monthlyIncome,
        String occupation,
        String currency,
        List<String> savingsGoals
    ) {}

    public record AuthHistoryEntry(String eventType, Instant occurredAt) {}
}
