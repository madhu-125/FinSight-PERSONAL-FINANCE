package com.finsight.auth.api;
// Defines the transaction fields returned to frontend clients.

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
