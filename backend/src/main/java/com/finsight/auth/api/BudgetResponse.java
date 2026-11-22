package com.finsight.auth.api;
// Defines the budget fields returned to frontend clients.

import java.math.BigDecimal;

public record BudgetResponse(
    Long id,
    String category,
    BigDecimal amount,
    String month,
    String periodType,
    String periodStart
) {}
