package com.finsight.auth.api;
// Exposes authenticated endpoints for user-owned financial transactions.

import com.finsight.auth.service.CurrentUserService;
import com.finsight.auth.service.FinanceTransactionService;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/transactions")
public class TransactionController {
    private static final String COOKIE_NAME = "finsight_session";

    private final CurrentUserService currentUser;
    private final FinanceTransactionService transactions;

    public TransactionController(CurrentUserService currentUser, FinanceTransactionService transactions) {
        this.currentUser = currentUser;
        this.transactions = transactions;
    }

    @GetMapping
    public List<TransactionResponse> list(
        @CookieValue(name = COOKIE_NAME, required = false) String token
    ) {
        return transactions.listForUser(currentUser.requireUserId(token));
    }

    @PostMapping
    public ResponseEntity<TransactionResponse> create(
        @CookieValue(name = COOKIE_NAME, required = false) String token,
        @RequestBody TransactionRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(transactions.create(currentUser.requireUserId(token), request));
    }
}
