package com.finsight.auth.service;

import com.finsight.auth.config.ClientOrigin;
import com.finsight.auth.service.AuthService.LoginResult;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

@Component
public class GoogleLoginSuccessHandler implements AuthenticationSuccessHandler {
    private static final String COOKIE_NAME = "finsight_session";
    private static final Duration SESSION_LIFETIME = Duration.ofDays(365);

    private final AuthService authService;
    private final String clientOrigin;
    private final boolean secureCookie;

    public GoogleLoginSuccessHandler(
        AuthService authService,
        @Value("${finsight.client-origin:http://localhost:3000}") String clientOrigin,
        @Value("${finsight.session.secure:false}") boolean secureCookie
    ) {
        this.authService = authService;
        this.clientOrigin = ClientOrigin.normalize(clientOrigin);
        this.secureCookie = secureCookie;
    }

    @Override
    public void onAuthenticationSuccess(
        HttpServletRequest request,
        HttpServletResponse response,
        Authentication authentication
    ) throws IOException, ServletException {
        if (!(authentication instanceof OAuth2AuthenticationToken oauth)
            || !"google".equals(oauth.getAuthorizedClientRegistrationId())) {
            response.sendRedirect(clientOrigin + "/?oauthError=google_login_failed");
            return;
        }

        OAuth2User user = oauth.getPrincipal();
        if (!Boolean.TRUE.equals(user.getAttribute("email_verified"))) {
            response.sendRedirect(clientOrigin + "/?oauthError=google_email_unverified");
            return;
        }

        LoginResult result = authService.loginWithGoogle(
            user.getAttribute("email"),
            user.getAttribute("name")
        );
        response.addHeader(
            HttpHeaders.SET_COOKIE,
            ResponseCookie.from(COOKIE_NAME, result.token())
                .httpOnly(true)
                .secure(secureCookie)
                .sameSite(secureCookie ? "None" : "Lax")
                .path("/")
                .maxAge(SESSION_LIFETIME)
                .build()
                .toString()
        );
        response.sendRedirect(clientOrigin + "/?oauth=success");
    }
}
