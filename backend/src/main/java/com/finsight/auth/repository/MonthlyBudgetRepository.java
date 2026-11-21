package com.finsight.auth.repository;

import com.finsight.auth.model.MonthlyBudget;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MonthlyBudgetRepository extends JpaRepository<MonthlyBudget, Long> {
    List<MonthlyBudget> findByUserIdOrderByPeriodStartDescCategoryAsc(Long userId);

    Optional<MonthlyBudget> findByUserIdAndCategoryIgnoreCaseAndPeriodStart(
        Long userId,
        String category,
        LocalDate periodStart
    );
}
