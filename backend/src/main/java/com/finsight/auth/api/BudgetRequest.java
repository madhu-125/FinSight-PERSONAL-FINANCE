package com.finsight.auth.api;

import java.math.BigDecimal;

public record BudgetRequest(String category, BigDecimal amount, String month) {}
