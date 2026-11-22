package com.finsight.auth.repository;
// Provides database queries for persisted authentication sessions.

import com.finsight.auth.model.AuthSession;
import java.time.Instant;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuthSessionRepository extends JpaRepository<AuthSession, String> {
    Optional<AuthSession> findByTokenHashAndExpiresAtAfter(String tokenHash, Instant now);

    void deleteByTokenHash(String tokenHash);

    long deleteByUserId(Long userId);

    long deleteByExpiresAtBefore(Instant now);
}
