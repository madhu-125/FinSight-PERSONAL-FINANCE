package com.finsight.auth.repository;
// Provides user-scoped database access for financial transactions.

import com.finsight.auth.model.FinanceTransaction;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FinanceTransactionRepository extends JpaRepository<FinanceTransaction, Long> {
    List<FinanceTransaction> findByUserIdOrderByTransactionDateDescIdDesc(Long userId);

    long deleteByUserId(Long userId);
}
