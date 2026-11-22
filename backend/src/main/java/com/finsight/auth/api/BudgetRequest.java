package com.finsight.auth.api;
// Defines and validates budget data accepted by the finance API.

import java.math.BigDecimal;

public record BudgetRequest(
    String category,
    BigDecimal amount,
    String month,
    String periodType,
    String periodStart
) {}
