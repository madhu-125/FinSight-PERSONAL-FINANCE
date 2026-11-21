package com.finsight.auth.api;

import java.math.BigDecimal;

public record AccountResponse(Long id, String name, String type, BigDecimal balance) {}
