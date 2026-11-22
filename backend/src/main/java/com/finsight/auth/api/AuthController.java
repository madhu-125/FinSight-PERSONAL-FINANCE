package com.finsight.auth.api;

// Maps authentication, password, and profile HTTP requests to AuthService.
import com.finsight.auth.config.ClientOrigin;
import com.finsight.auth.service.AuthService;
import com.finsight.auth.service.AuthService.LoginResult;
import com.finsight.auth.service.AuthService.OtpSent;
import com.finsight.auth.service.AuthService.ProfileInfo;
import com.finsight.auth.service.AuthService.SessionInfo;
import java.net.URI;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
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
    private final boolean googleOAuthEnabled;
    private final String clientOrigin;

    public AuthController(
        AuthService authService,
        @Value("${finsight.session.secure:false}") boolean secureCookie,
        @Value("${finsight.demo-auth.enabled:false}") boolean demoAuthEnabled,
        @Value("${finsight.google.client-id:}") String googleClientId,
        @Value("${finsight.google.client-secret:}") String googleClientSecret,
        @Value("${finsight.client-origin:http://localhost:3000}") String clientOrigin
    ) {
        this.authService = authService;
        this.secureCookie = secureCookie;
        this.demoAuthEnabled = demoAuthEnabled;
        this.googleOAuthEnabled = !googleClientId.isBlank() && !googleClientSecret.isBlank();
        this.clientOrigin = ClientOrigin.normalize(clientOrigin);
    }

    @GetMapping("/oauth/google")
    public ResponseEntity<Void> googleOAuthStart() {
        URI destination = !googleOAuthEnabled
            ? URI.create(clientOrigin + "/?oauthError=google_not_configured")
            : URI.create("/oauth2/authorization/google");
        return ResponseEntity.status(HttpStatus.SEE_OTHER).location(destination).build();
    }

    @PostMapping("/otp/send")
    public Map<String, Object> sendOtp(@RequestBody OtpSendRequest request) {
        OtpSent sent = authService.sendOtp(request);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("sent", true);
        body.put("channel", sent.channel());
        body.put("expiresInSeconds", sent.expiresInSeconds());
        body.put("resendAfterSeconds", sent.resendAfterSeconds());
        return body;
    }

    @PostMapping("/password/login")
    public ResponseEntity<Map<String, Object>> passwordLogin(@RequestBody PasswordLoginRequest request) {
        return authenticatedResponse(authService.passwordLogin(request));
    }

    @PostMapping("/password/register")
    public ResponseEntity<Map<String, Object>> passwordRegister(@RequestBody PasswordRegisterRequest request) {
        return authenticatedResponse(authService.passwordRegister(request));
    }

    private ResponseEntity<Map<String, Object>> authenticatedResponse(LoginResult result) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("authenticated", true);
        body.put("channel", result.channel());
        body.put(result.channel().equals("email") ? "email" : "phone", result.destination());
        if (result.displayName() != null) {
            body.put("displayName", result.displayName());
        }
        return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, sessionCookie(result.token(), SESSION_LIFETIME).toString())
            .body(body);
    }

    @PostMapping("/password/forgot")
    public Map<String, Object> sendPasswordResetOtp(@RequestBody OtpSendRequest request) {
        authService.sendPasswordResetOtp(request);
        return Map.of(
            "sent", true,
            "message", "If an account exists for that address or number, a reset code has been sent."
        );
    }

    @PostMapping("/password/reset")
    public Map<String, Object> resetPassword(@RequestBody PasswordResetRequest request) {
        authService.resetPassword(request);
        return Map.of("reset", true);
    }

    @PutMapping("/password")
    public Map<String, Object> changePassword(
        @CookieValue(name = COOKIE_NAME, required = false) String token,
        @RequestBody PasswordChangeRequest request
    ) {
        authService.changePassword(token, request);
        return Map.of("updated", true);
    }

    @PutMapping("/profile")
    public Map<String, Object> updateProfile(
        @CookieValue(name = COOKIE_NAME, required = false) String token,
        @RequestBody ProfileUpdateRequest request
    ) {
        return profileResponse(authService.updateProfile(token, request));
    }

    @GetMapping("/profile")
    public Map<String, Object> profile(
        @CookieValue(name = COOKIE_NAME, required = false) String token
    ) {
        return profileResponse(authService.getProfile(token));
    }

    private Map<String, Object> profileResponse(ProfileInfo profile) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("displayName", profile.displayName());
        body.put(profile.channel().equals("email") ? "email" : "phone", profile.destination());
        body.put("age", profile.age());
        body.put("gender", profile.gender());
        body.put("mobileNumber", profile.mobileNumber());
        body.put("address", profile.address());
        return body;
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

    @GetMapping("/history")
    public List<AuthService.AuthHistoryEntry> history(
        @CookieValue(name = COOKIE_NAME, required = false) String token
    ) {
        return authService.getAuthHistory(token);
    }

    @DeleteMapping("/account")
    public ResponseEntity<Map<String, Object>> deleteAccount(
        @CookieValue(name = COOKIE_NAME, required = false) String token
    ) {
        authService.deleteAccount(token);
        return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, sessionCookie("", Duration.ZERO).toString())
            .body(Map.of("deleted", true));
    }

    private ResponseCookie sessionCookie(String value, Duration maxAge) {
        return ResponseCookie.from(COOKIE_NAME, value)
            .httpOnly(true)
            .secure(secureCookie)
            .sameSite(secureCookie ? "None" : "Lax")
            .path("/")
            .maxAge(maxAge)
            .build();
    }
}
