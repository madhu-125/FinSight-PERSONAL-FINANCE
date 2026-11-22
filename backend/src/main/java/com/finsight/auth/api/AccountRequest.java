package com.finsight.auth.api;
// Defines and validates account data accepted by the finance API.

import java.math.BigDecimal;

public record AccountRequest(String name, String type, BigDecimal balance) {}
