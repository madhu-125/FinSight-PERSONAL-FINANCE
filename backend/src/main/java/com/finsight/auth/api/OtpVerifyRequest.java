package com.finsight.auth.api;

public record OtpVerifyRequest(
    String channel,
    String email,
    String phone,
    String code,
    String displayName
) {}
