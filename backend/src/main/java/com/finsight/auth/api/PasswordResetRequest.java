package com.finsight.auth.api;
// Defines the contact, reset code, and new password for account recovery.

public record PasswordResetRequest(
    String channel,
    String email,
    String phone,
    String code,
    String newPassword
) {}
