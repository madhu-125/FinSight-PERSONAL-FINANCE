package com.finsight.auth.api;

import java.math.BigDecimal;

public record AccountRequest(String name, String type, BigDecimal balance) {}
