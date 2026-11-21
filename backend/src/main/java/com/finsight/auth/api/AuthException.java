package com.finsight.auth.api;

import org.springframework.http.HttpStatus;

public class AuthException extends RuntimeException {
    private final HttpStatus status;
    private final Long retryAfterSeconds;

    public AuthException(HttpStatus status, String message) {
        this(status, message, null);
    }

    public AuthException(HttpStatus status, String message, Long retryAfterSeconds) {
        super(message);
        this.status = status;
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public Long getRetryAfterSeconds() {
        return retryAfterSeconds;
    }
}
