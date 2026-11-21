package com.finsight.auth.service;

import com.finsight.auth.api.AccountRequest;
import com.finsight.auth.api.AccountResponse;
import com.finsight.auth.api.AuthException;
import com.finsight.auth.model.FinanceAccount;
import com.finsight.auth.repository.FinanceAccountRepository;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FinanceAccountService {
    private static final List<String> ACCOUNT_TYPES = List.of("cash", "checking", "savings", "credit");

    private final FinanceAccountRepository accounts;

    public FinanceAccountService(FinanceAccountRepository accounts) {
        this.accounts = accounts;
    }

    @Transactional(readOnly = true)
    public List<AccountResponse> listForUser(Long userId) {
        return accounts.findByUserIdOrderByNameAsc(userId)
            .stream()
            .map(this::toResponse)
            .toList();
    }

    @Transactional
    public AccountResponse create(Long userId, AccountRequest request) {
        if (request == null) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "Account details are required.");
        }
        String name = requiredText(request.name(), "Account name", 80);
        String type = requiredText(request.type(), "Account type", 12).toLowerCase(Locale.ROOT);
        if (!ACCOUNT_TYPES.contains(type)) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "Choose cash, checking, savings, or credit.");
        }

        FinanceAccount account = accounts.save(new FinanceAccount(
            userId,
            name,
            type,
            MoneyAmount.normalize(request.balance(), true),
            Instant.now()
        ));
        return toResponse(account);
    }

    private String requiredText(String value, String label, int maxLength) {
        String trimmed = value == null ? "" : value.trim();
        if (trimmed.isEmpty() || trimmed.length() > maxLength) {
            throw new AuthException(
                HttpStatus.BAD_REQUEST,
                label + " is required and must be " + maxLength + " characters or fewer."
            );
        }
        return trimmed;
    }

    private AccountResponse toResponse(FinanceAccount account) {
        return new AccountResponse(
            account.getId(),
            account.getName(),
            account.getType(),
            account.getBalance()
        );
    }
}
