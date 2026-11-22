package com.finsight.auth.model;
// Maps sign-in and sign-out events to their owning account.

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(
    name = "auth_history",
    indexes = @Index(name = "idx_auth_history_user_time", columnList = "user_id,occurred_at")
)
public class AuthHistory {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "event_type", nullable = false, length = 16)
    private String eventType;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    protected AuthHistory() {
    }

    public AuthHistory(Long userId, String eventType, Instant occurredAt) {
        this.userId = userId;
        this.eventType = eventType;
        this.occurredAt = occurredAt;
    }

    public Long getId() {
        return id;
    }

    public String getEventType() {
        return eventType;
    }

    public Instant getOccurredAt() {
        return occurredAt;
    }
}
