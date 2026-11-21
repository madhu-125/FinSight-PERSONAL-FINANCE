package com.finsight.auth.api;

import com.finsight.auth.service.AuthService;
import com.finsight.auth.service.AuthService.LoginResult;
import com.finsight.auth.service.AuthService.OtpSent;
import com.finsight.auth.service.AuthService.SessionInfo;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private static final String COOKIE_NAME = "finsight_session";
    private static final Duration SESSION_LIFETIME = Duration.ofDays(365);

    private final AuthService authService;
    private final boolean secureCookie;
    private final boolean demoAuthEnabled;

    public AuthController(
        AuthService authService,
        @Value("${finsight.session.secure:false}") boolean secureCookie,
        @Value("${finsight.demo-auth.enabled:false}") boolean demoAuthEnabled
    ) {
        this.authService = authService;
        this.secureCookie = secureCookie;
        this.demoAuthEnabled = demoAuthEnabled;
    }

    @PostMapping("/otp/send")
    public Map<String, Object> sendOtp(@RequestBody OtpSendRequest request) {
        OtpSent sent = authService.sendOtp(request);
        return Map.of(
            "sent", true,
            "channel", sent.channel(),
            "expiresInSeconds", sent.expiresInSeconds(),
            "resendAfterSeconds", sent.resendAfterSeconds()
        );
    }

    @PostMapping("/otp/verify")
    public ResponseEntity<Map<String, Object>> verifyOtp(@RequestBody OtpVerifyRequest request) {
        LoginResult result = authService.verifyOtp(request);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("verified", true);
        body.put("channel", result.channel());
        if (result.displayName() != null) {
            body.put("displayName", result.displayName());
        }
        return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, sessionCookie(result.token(), SESSION_LIFETIME).toString())
            .body(body);
    }

    @PostMapping("/demo")
    public ResponseEntity<Map<String, Object>> demoLogin(@RequestBody DemoLoginRequest request) {
        if (!demoAuthEnabled) {
            throw new AuthException(HttpStatus.NOT_FOUND, "Endpoint not found.");
        }
        if (request == null) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "Enter an email or phone to continue.");
        }

        LoginResult result = authService.createDemoSession(
            request.channel(),
            request.email(),
            request.phone(),
            request.displayName()
        );
        return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, sessionCookie(result.token(), SESSION_LIFETIME).toString())
            .body(Map.of("authenticated", true));
    }

    @GetMapping("/session")
    public Map<String, Object> session(
        @CookieValue(name = COOKIE_NAME, required = false) String token
    ) {
        Optional<SessionInfo> session = authService.getSession(token);
        if (session.isEmpty()) {
            return Map.of("authenticated", false);
        }

        SessionInfo info = session.get();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("authenticated", true);
        body.put("channel", info.channel());
        body.put(info.channel().equals("email") ? "email" : "phone", info.destination());
        if (info.displayName() != null) {
            body.put("displayName", info.displayName());
        }
        return body;
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, Object>> logout(
        @CookieValue(name = COOKIE_NAME, required = false) String token
    ) {
        authService.logout(token);
        return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, sessionCookie("", Duration.ZERO).toString())
            .body(Map.of("loggedOut", true));
    }

    private ResponseCookie sessionCookie(String value, Duration maxAge) {
        return ResponseCookie.from(COOKIE_NAME, value)
            .httpOnly(true)
            .secure(secureCookie)
            .sameSite("Lax")
            .path("/")
            .maxAge(maxAge)
            .build();
    }
}
