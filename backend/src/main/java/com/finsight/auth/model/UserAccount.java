package com.finsight.auth.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

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
}
