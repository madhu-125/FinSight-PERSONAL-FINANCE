package com.finsight.auth.model;
// Maps account identity, password, and profile fields persisted by the API.

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(
    name = "finsight_users",
    uniqueConstraints = @UniqueConstraint(
        name = "uq_finsight_user_identity",
        columnNames = {"channel", "destination"}
    )
)
public class UserAccount {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 8)
    private String channel;

    @Column(nullable = false, length = 254)
    private String destination;

    @Column(name = "display_name", length = 120)
    private String displayName;

    @Column(name = "profile_age")
    private Integer age;

    @Column(name = "profile_gender", length = 40)
    private String gender;

    @Column(name = "profile_mobile", length = 30)
    private String mobileNumber;

    @Column(name = "profile_address", length = 500)
    private String address;

    @Column(name = "profile_monthly_income", precision = 19, scale = 2)
    private BigDecimal monthlyIncome;

    @Column(name = "profile_occupation", length = 100)
    private String occupation;

    @Column(name = "profile_currency", nullable = false, length = 3)
    private String currency = "INR";

    @Column(name = "profile_savings_goals", length = 500)
    private String savingsGoals;

    @Column(name = "password_hash", length = 100)
    private String passwordHash;

    @Column(name = "failed_password_attempts", nullable = false)
    private int failedPasswordAttempts;

    @Column(name = "password_locked_until")
    private Instant passwordLockedUntil;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "last_login_at", nullable = false)
    private Instant lastLoginAt;

    protected UserAccount() {
    }

    public UserAccount(String channel, String destination, String displayName, Instant now) {
        this.channel = channel;
        this.destination = destination;
        this.displayName = displayName;
        this.createdAt = now;
        this.lastLoginAt = now;
    }

    public Long getId() {
        return id;
    }

    public String getChannel() {
        return channel;
    }

    public String getDestination() {
        return destination;
    }

    public String getDisplayName() {
        return displayName;
    }

    public Integer getAge() {
        return age;
    }

    public String getGender() {
        return gender;
    }

    public String getMobileNumber() {
        return mobileNumber;
    }

    public String getAddress() {
        return address;
    }

    public BigDecimal getMonthlyIncome() {
        return monthlyIncome;
    }

    public String getOccupation() {
        return occupation;
    }

    public String getCurrency() {
        return currency;
    }

    public String getSavingsGoals() {
        return savingsGoals;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getLastLoginAt() {
        return lastLoginAt;
    }

    public void recordLogin(String name, Instant now) {
        if (name != null && !name.isBlank()) {
            this.displayName = name.trim();
        }
        this.lastLoginAt = now;
    }

    public void updateDisplayName(String name) {
        this.displayName = name;
    }

    public void updateProfile(Integer age, String gender, String mobileNumber, String address) {
        this.age = age;
        this.gender = gender;
        this.mobileNumber = mobileNumber;
        this.address = address;
    }

    public void updateFinancialProfile(
        BigDecimal monthlyIncome,
        String occupation,
        String currency,
        String savingsGoals
    ) {
        if (monthlyIncome != null) {
            this.monthlyIncome = monthlyIncome;
        }
        if (occupation != null) {
            this.occupation = occupation;
        }
        if (currency != null) {
            this.currency = currency;
        }
        if (savingsGoals != null) {
            this.savingsGoals = savingsGoals;
        }
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
        resetPasswordFailures();
    }

    public boolean isPasswordLocked(Instant now) {
        return passwordLockedUntil != null && passwordLockedUntil.isAfter(now);
    }

    public void recordFailedPasswordAttempt(Instant now) {
        failedPasswordAttempts++;
        if (failedPasswordAttempts >= 5) {
            failedPasswordAttempts = 0;
            passwordLockedUntil = now.plusSeconds(15 * 60);
        }
    }

    public void resetPasswordFailures() {
        failedPasswordAttempts = 0;
        passwordLockedUntil = null;
    }
}
