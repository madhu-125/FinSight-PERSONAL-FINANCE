package com.finsight.auth.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(
    name = "otp_challenges",
    indexes = @Index(name = "idx_otp_challenges_expires_at", columnList = "expires_at")
)
public class OtpChallenge {
    @Id
    @Column(name = "challenge_key", length = 264)
    private String challengeKey;

    @Column(nullable = false, length = 8)
    private String channel;

    @Column(nullable = false, length = 254)
    private String destination;

    @Column(name = "code_hash", nullable = false, length = 64)
    private String codeHash;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "resend_at", nullable = false)
    private Instant resendAt;

    @Column(nullable = false)
    private int attempts;

    protected OtpChallenge() {
    }

    public OtpChallenge(
        String challengeKey,
        String channel,
        String destination,
        String codeHash,
        Instant expiresAt,
        Instant resendAt
    ) {
        this.challengeKey = challengeKey;
        this.channel = channel;
        this.destination = destination;
        this.codeHash = codeHash;
        this.expiresAt = expiresAt;
        this.resendAt = resendAt;
        this.attempts = 0;
    }

    public String getChallengeKey() {
        return challengeKey;
    }

    public String getChannel() {
        return channel;
    }

    public String getDestination() {
        return destination;
    }

    public String getCodeHash() {
        return codeHash;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public Instant getResendAt() {
        return resendAt;
    }

    public int getAttempts() {
        return attempts;
    }

    public int recordFailedAttempt() {
        return ++attempts;
    }
}
