package com.finsight.auth.api;
// Defines the contact and one-time code used to complete sign-in.

public record OtpVerifyRequest(
    String channel,
    String email,
    String phone,
    String code,
    String displayName,
    String password
) {}
