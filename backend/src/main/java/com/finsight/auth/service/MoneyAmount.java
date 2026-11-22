package com.finsight.auth.service;
// Normalizes and validates monetary values used by finance services.

import com.finsight.auth.api.AuthException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import org.springframework.http.HttpStatus;

final class MoneyAmount {
    private MoneyAmount() {
    }

    static BigDecimal normalize(BigDecimal amount, boolean allowZero) {
        if (amount == null || amount.signum() < 0 || (!allowZero && amount.signum() == 0)) {
            throw new AuthException(
                HttpStatus.BAD_REQUEST,
                allowZero ? "Amount cannot be negative." : "Amount must be greater than zero."
            );
        }

        BigDecimal normalized;
        try {
            normalized = amount.setScale(2, RoundingMode.UNNECESSARY);
        } catch (ArithmeticException exception) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "Amount can have at most two decimal places.");
        }
        if (normalized.precision() > 12) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "Amount is too large.");
        }
        return normalized;
    }
}
