package com.finsight.auth.api;
// Defines the account fields returned to frontend clients.

import java.math.BigDecimal;

public record AccountResponse(Long id, String name, String type, BigDecimal balance) {}
