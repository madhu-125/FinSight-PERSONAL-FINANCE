package com.finsight.auth.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(
    name = "monthly_budgets",
    uniqueConstraints = @UniqueConstraint(
        name = "uq_monthly_budgets_user_category_period",
        columnNames = {"user_id", "category", "period_start"}
    ),
    indexes = @Index(
        name = "idx_monthly_budgets_user_period",
        columnList = "user_id,period_start"
    )
)
public class MonthlyBudget {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, length = 60)
    private String category;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(name = "period_start", nullable = false)
    private LocalDate periodStart;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected MonthlyBudget() {
    }

    public MonthlyBudget(Long userId, String category, BigDecimal amount, LocalDate periodStart, Instant now) {
        this.userId = userId;
        this.category = category;
        this.amount = amount;
        this.periodStart = periodStart;
        this.createdAt = now;
        this.updatedAt = now;
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public String getCategory() {
        return category;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public LocalDate getPeriodStart() {
        return periodStart;
    }

    public void updateAmount(BigDecimal newAmount, Instant now) {
        this.amount = newAmount;
        this.updatedAt = now;
    }
}
