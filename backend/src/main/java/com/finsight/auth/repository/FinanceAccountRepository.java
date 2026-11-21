package com.finsight.auth.repository;

import com.finsight.auth.model.FinanceAccount;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FinanceAccountRepository extends JpaRepository<FinanceAccount, Long> {
    List<FinanceAccount> findByUserIdOrderByNameAsc(Long userId);
}
