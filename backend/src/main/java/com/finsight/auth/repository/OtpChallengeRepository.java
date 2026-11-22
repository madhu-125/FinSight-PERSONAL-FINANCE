package com.finsight.auth.repository;
// Provides database queries for one-time verification challenges.

import com.finsight.auth.model.OtpChallenge;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OtpChallengeRepository extends JpaRepository<OtpChallenge, String> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select challenge from OtpChallenge challenge where challenge.challengeKey = :key")
    Optional<OtpChallenge> findForUpdate(@Param("key") String key);

    long deleteByExpiresAtBefore(Instant now);
}
