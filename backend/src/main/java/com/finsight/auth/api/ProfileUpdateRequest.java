package com.finsight.auth.api;
// Defines the editable profile fields accepted by the authenticated API.

import java.math.BigDecimal;
import java.util.List;

public record ProfileUpdateRequest(
    String displayName,
    Integer age,
    String gender,
    String mobileNumber,
    String address,
    BigDecimal monthlyIncome,
    String occupation,
    String currency,
    List<String> savingsGoals
) {}
