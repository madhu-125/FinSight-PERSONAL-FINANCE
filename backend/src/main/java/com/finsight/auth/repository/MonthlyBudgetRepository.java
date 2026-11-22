package com.finsight.auth.repository;
// Provides user-scoped database access for budgets.

import com.finsight.auth.model.MonthlyBudget;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MonthlyBudgetRepository extends JpaRepository<MonthlyBudget, Long> {
    List<MonthlyBudget> findByUserIdOrderByPeriodStartDescCategoryAsc(Long userId);

    Optional<MonthlyBudget> findByUserIdAndCategoryIgnoreCaseAndPeriodTypeAndPeriodStart(
        Long userId,
        String category,
        String periodType,
        LocalDate periodStart
    );
}
