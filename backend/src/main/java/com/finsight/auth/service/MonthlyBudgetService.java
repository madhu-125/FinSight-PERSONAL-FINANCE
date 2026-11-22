package com.finsight.auth.service;
// Validates and manages user budgets and their reporting periods.

import com.finsight.auth.api.AuthException;
import com.finsight.auth.api.BudgetRequest;
import com.finsight.auth.api.BudgetResponse;
import com.finsight.auth.model.MonthlyBudget;
import com.finsight.auth.repository.MonthlyBudgetRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.DayOfWeek;
import java.time.temporal.TemporalAdjusters;
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

        String periodType = request.periodType() == null || request.periodType().isBlank()
            ? "MONTHLY"
            : request.periodType().trim().toUpperCase(java.util.Locale.ROOT);
        if (!List.of("WEEKLY", "MONTHLY", "BIMONTHLY").contains(periodType)) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "Choose a valid budget period.");
        }

        LocalDate selectedDate;
        if (request.periodStart() != null && !request.periodStart().isBlank()) {
            try {
                selectedDate = LocalDate.parse(request.periodStart());
            } catch (DateTimeParseException exception) {
                throw new AuthException(HttpStatus.BAD_REQUEST, "Choose a valid budget period start.");
            }
        } else {
            try {
                selectedDate = YearMonth.parse(request.month()).atDay(1);
            } catch (DateTimeParseException | NullPointerException exception) {
                throw new AuthException(HttpStatus.BAD_REQUEST, "Choose a valid budget month.");
            }
        }
        LocalDate periodStart = switch (periodType) {
            case "WEEKLY" -> selectedDate.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            case "BIMONTHLY" -> LocalDate.of(
                selectedDate.getYear(),
                ((selectedDate.getMonthValue() - 1) / 2) * 2 + 1,
                1
            );
            default -> YearMonth.from(selectedDate).atDay(1);
        };
        var amount = MoneyAmount.normalize(request.amount(), false);
        Instant now = Instant.now();
        MonthlyBudget budget = budgets.findByUserIdAndCategoryIgnoreCaseAndPeriodTypeAndPeriodStart(
                userId,
                category,
                periodType,
                periodStart
            )
            .map(existing -> {
                existing.updateAmount(amount, now);
                return existing;
            })
            .orElseGet(() -> new MonthlyBudget(userId, category, amount, periodType, periodStart, now));
        return toResponse(budgets.save(budget));
    }

    private BudgetResponse toResponse(MonthlyBudget budget) {
        return new BudgetResponse(
            budget.getId(),
            budget.getCategory(),
            budget.getAmount(),
            YearMonth.from(budget.getPeriodStart()).toString(),
            budget.getPeriodType(),
            budget.getPeriodStart().toString()
        );
    }
}
