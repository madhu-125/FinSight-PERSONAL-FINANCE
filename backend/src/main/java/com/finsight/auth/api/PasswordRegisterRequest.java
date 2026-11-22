package com.finsight.auth.api;
// Defines the contact, display name, and password used to create an account.

public record PasswordRegisterRequest(
    String channel,
    String email,
    String phone,
    String displayName,
    String password
) {}
