package com.finsight.auth.api;
// Defines the verified contact used to request a one-time sign-in code.

public record OtpSendRequest(String channel, String email, String phone, String displayName) {}
