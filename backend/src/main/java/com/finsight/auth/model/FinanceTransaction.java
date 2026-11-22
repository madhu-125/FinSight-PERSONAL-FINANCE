package com.finsight.auth.model;
// Maps a dated income or expense transaction to its owning user.

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(
    name = "financial_transactions",
    indexes = @Index(
        name = "idx_financial_transactions_user_date",
        columnList = "user_id,transaction_date"
    )
)
public class FinanceTransaction {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, length = 120)
    private String description;

    @Column(nullable = false, length = 60)
    private String category;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, length = 8)
    private String type;

    @Column(name = "transaction_date", nullable = false)
    private LocalDate transactionDate;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected FinanceTransaction() {
    }

    public FinanceTransaction(
        Long userId,
        String description,
        String category,
        BigDecimal amount,
        String type,
        LocalDate transactionDate,
        Instant createdAt
    ) {
        this.userId = userId;
        this.description = description;
        this.category = category;
        this.amount = amount;
        this.type = type;
        this.transactionDate = transactionDate;
        this.createdAt = createdAt;
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public String getDescription() {
        return description;
    }

    public String getCategory() {
        return category;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public String getType() {
        return type;
    }

    public LocalDate getTransactionDate() {
        return transactionDate;
    }
}
