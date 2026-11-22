package com.finsight.auth.repository;
// Provides user-scoped database access for finance accounts.

import com.finsight.auth.model.FinanceAccount;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FinanceAccountRepository extends JpaRepository<FinanceAccount, Long> {
    List<FinanceAccount> findByUserIdOrderByNameAsc(Long userId);

    long deleteByUserId(Long userId);
}
