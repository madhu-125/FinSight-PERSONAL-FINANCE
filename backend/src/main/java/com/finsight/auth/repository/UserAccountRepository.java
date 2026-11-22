package com.finsight.auth.repository;
// Provides database lookups and persistence for user accounts.

import com.finsight.auth.model.UserAccount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserAccountRepository extends JpaRepository<UserAccount, Long> {
    Optional<UserAccount> findByChannelAndDestination(String channel, String destination);
}
