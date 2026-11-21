package com.finsight.auth.service;

import com.finsight.auth.api.AuthException;
import com.finsight.auth.service.AuthService.SessionInfo;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class CurrentUserService {
    private final AuthService authService;

    public CurrentUserService(AuthService authService) {
        this.authService = authService;
    }

    public Long requireUserId(String token) {
        SessionInfo session = authService.getSession(token)
            .orElseThrow(() -> new AuthException(HttpStatus.UNAUTHORIZED, "Please sign in to continue."));
        return session.userId();
    }
}
