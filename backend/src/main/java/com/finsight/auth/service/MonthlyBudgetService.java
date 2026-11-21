package com.finsight.auth.service;

import com.finsight.auth.api.AuthException;
import com.finsight.auth.api.BudgetRequest;
import com.finsight.auth.api.BudgetResponse;
import com.finsight.auth.model.MonthlyBudget;
import com.finsight.auth.repository.MonthlyBudgetRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MonthlyBudgetService {
    private final MonthlyBudgetRepository budgets;

    public MonthlyBudgetService(MonthlyBudgetRepository budgets) {
        this.budgets = budgets;
    }

    @Transactional(readOnly = true)
    public List<BudgetResponse> listForUser(Long userId) {
        return budgets.findByUserIdOrderByPeriodStartDescCategoryAsc(userId)
            .stream()
            .map(this::toResponse)
            .toList();
    }

    @Transactional
    public BudgetResponse save(Long userId, BudgetRequest request) {
        if (request == null) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "Budget details are required.");
        }
        String category = request.category() == null ? "" : request.category().trim();
        if (category.isEmpty() || category.length() > 60) {
            throw new AuthException(
                HttpStatus.BAD_REQUEST,
                "Category is required and must be 60 characters or fewer."
            );
        }

        YearMonth month;
        try {
            month = YearMonth.parse(request.month());
        } catch (DateTimeParseException | NullPointerException exception) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "Choose a valid budget month.");
        }

        var amount = MoneyAmount.normalize(request.amount(), false);
        LocalDate periodStart = month.atDay(1);
        Instant now = Instant.now();
        MonthlyBudget budget = budgets.findByUserIdAndCategoryIgnoreCaseAndPeriodStart(
                userId,
                category,
                periodStart
            )
            .map(existing -> {
                existing.updateAmount(amount, now);
                return existing;
            })
            .orElseGet(() -> new MonthlyBudget(userId, category, amount, periodStart, now));
        return toResponse(budgets.save(budget));
    }

    private BudgetResponse toResponse(MonthlyBudget budget) {
        return new BudgetResponse(
            budget.getId(),
            budget.getCategory(),
            budget.getAmount(),
            YearMonth.from(budget.getPeriodStart()).toString()
        );
    }
}
