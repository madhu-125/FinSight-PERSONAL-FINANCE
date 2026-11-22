package com.finsight.auth.repository;
// Provides user-scoped queries for successful login and logout history.

import com.finsight.auth.model.AuthHistory;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuthHistoryRepository extends JpaRepository<AuthHistory, Long> {
    List<AuthHistory> findTop100ByUserIdOrderByOccurredAtDescIdDesc(Long userId);

    long deleteByUserId(Long userId);
}
