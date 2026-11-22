package com.finsight.auth.api;
// Defines the editable profile fields accepted by the authenticated API.

public record ProfileUpdateRequest(
    String displayName,
    Integer age,
    String gender,
    String mobileNumber,
    String address
) {}
