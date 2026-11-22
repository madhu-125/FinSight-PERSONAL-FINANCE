package com.finsight.auth.api;

// Exposes authenticated HTTP endpoints for user-owned finance accounts.
import com.finsight.auth.service.CurrentUserService;
import com.finsight.auth.service.FinanceAccountService;
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
@RequestMapping("/api/accounts")
public class AccountController {
    private static final String COOKIE_NAME = "finsight_session";

    private final CurrentUserService currentUser;
    private final FinanceAccountService accounts;

    public AccountController(CurrentUserService currentUser, FinanceAccountService accounts) {
        this.currentUser = currentUser;
        this.accounts = accounts;
    }

    @GetMapping
    public List<AccountResponse> list(
        @CookieValue(name = COOKIE_NAME, required = false) String token
    ) {
        return accounts.listForUser(currentUser.requireUserId(token));
    }

    @PostMapping
    public ResponseEntity<AccountResponse> create(
        @CookieValue(name = COOKIE_NAME, required = false) String token,
        @RequestBody AccountRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(accounts.create(currentUser.requireUserId(token), request));
    }
}
