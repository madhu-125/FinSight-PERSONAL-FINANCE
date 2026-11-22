package com.finsight.auth.api;
// Exposes authenticated endpoints for the signed-in user's budgets.

import com.finsight.auth.service.CurrentUserService;
import com.finsight.auth.service.MonthlyBudgetService;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/budgets")
public class BudgetController {
    private static final String COOKIE_NAME = "finsight_session";

    private final CurrentUserService currentUser;
    private final MonthlyBudgetService budgets;

    public BudgetController(CurrentUserService currentUser, MonthlyBudgetService budgets) {
        this.currentUser = currentUser;
        this.budgets = budgets;
    }

    @GetMapping
    public List<BudgetResponse> list(
        @CookieValue(name = COOKIE_NAME, required = false) String token
    ) {
        return budgets.listForUser(currentUser.requireUserId(token));
    }

    @PostMapping
    public ResponseEntity<BudgetResponse> save(
        @CookieValue(name = COOKIE_NAME, required = false) String token,
        @RequestBody BudgetRequest request
    ) {
        return ResponseEntity.ok(budgets.save(currentUser.requireUserId(token), request));
    }
}
