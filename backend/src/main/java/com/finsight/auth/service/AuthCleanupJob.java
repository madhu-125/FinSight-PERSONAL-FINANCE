package com.finsight.auth.service;

import com.finsight.auth.repository.AuthSessionRepository;
import com.finsight.auth.repository.OtpChallengeRepository;
import java.time.Instant;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class AuthCleanupJob {
    private final OtpChallengeRepository challenges;
    private final AuthSessionRepository sessions;

    public AuthCleanupJob(OtpChallengeRepository challenges, AuthSessionRepository sessions) {
        this.challenges = challenges;
        this.sessions = sessions;
    }

    @Scheduled(fixedRateString = "${finsight.cleanup.interval-ms:3600000}")
    @Transactional
    public void removeExpiredRecords() {
        Instant now = Instant.now();
        challenges.deleteByExpiresAtBefore(now);
        sessions.deleteByExpiresAtBefore(now);
    }
}
