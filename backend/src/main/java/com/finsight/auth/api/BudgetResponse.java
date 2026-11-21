package com.finsight.auth.api;

import java.math.BigDecimal;

public record BudgetResponse(Long id, String category, BigDecimal amount, String month) {}
