package com.finsight.auth.api;
// Defines transaction data accepted by the finance API.

import java.math.BigDecimal;
import java.time.LocalDate;

public record TransactionRequest(
    String description,
    String category,
    BigDecimal amount,
    String type,
    LocalDate transactionDate
) {}
