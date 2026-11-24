package com.finsight.auth.service;
// Validates and manages transactions within the current user's scope.

import com.finsight.auth.api.AuthException;
import com.finsight.auth.api.TransactionRequest;
import com.finsight.auth.api.TransactionResponse;
import com.finsight.auth.model.FinanceTransaction;
import com.finsight.auth.repository.FinanceTransactionRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FinanceTransactionService {
    private final FinanceTransactionRepository transactions;

    public FinanceTransactionService(FinanceTransactionRepository transactions) {
        this.transactions = transactions;
    }

    @Transactional(readOnly = true)
    public List<TransactionResponse> listForUser(Long userId) {
        return transactions.findByUserIdOrderByTransactionDateDescIdDesc(userId)
            .stream()
            .map(this::toResponse)
            .toList();
    }

    @Transactional
    public long deleteAllForUser(Long userId) {
        return transactions.deleteByUserId(userId);
    }

    @Transactional
    public TransactionResponse create(Long userId, TransactionRequest request) {
        if (request == null) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "Transaction details are required.");
        }
        String description = requiredText(request.description(), "Description", 120);
        String category = requiredText(request.category(), "Category", 60);
        String type = requiredText(request.type(), "Type", 8).toLowerCase(Locale.ROOT);
        BigDecimal amount = MoneyAmount.normalize(request.amount(), false);
        LocalDate transactionDate = request.transactionDate();

        if (!type.equals("income") && !type.equals("expense")) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "Type must be income or expense.");
        }
        if (transactionDate == null) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "Enter a transaction date.");
        }

        FinanceTransaction transaction = transactions.save(new FinanceTransaction(
            userId,
            description,
            category,
            amount,
            type,
            transactionDate,
            Instant.now()
        ));
        return toResponse(transaction);
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

    private TransactionResponse toResponse(FinanceTransaction transaction) {
        return new TransactionResponse(
            transaction.getId(),
            transaction.getDescription(),
            transaction.getCategory(),
            transaction.getAmount(),
            transaction.getType(),
            transaction.getTransactionDate()
        );
    }
}
