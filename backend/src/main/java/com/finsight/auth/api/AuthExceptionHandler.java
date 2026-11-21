package com.finsight.auth.api;

import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class AuthExceptionHandler {
    @ExceptionHandler(AuthException.class)
    public ResponseEntity<Map<String, Object>> handleAuthException(AuthException exception) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", exception.getMessage());
        if (exception.getRetryAfterSeconds() != null) {
            body.put("retryAfterSeconds", exception.getRetryAfterSeconds());
        }
        return ResponseEntity.status(exception.getStatus()).body(body);
    }
}
