package com.finsight.auth.api;

import java.math.BigDecimal;
import java.time.LocalDate;

public record TransactionResponse(
    Long id,
    String description,
    String category,
    BigDecimal amount,
    String type,
    LocalDate transactionDate
) {}
