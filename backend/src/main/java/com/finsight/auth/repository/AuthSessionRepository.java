package com.finsight.auth.repository;

import com.finsight.auth.model.AuthSession;
import java.time.Instant;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuthSessionRepository extends JpaRepository<AuthSession, String> {
    Optional<AuthSession> findByTokenHashAndExpiresAtAfter(String tokenHash, Instant now);

    void deleteByTokenHash(String tokenHash);

    long deleteByExpiresAtBefore(Instant now);
}
