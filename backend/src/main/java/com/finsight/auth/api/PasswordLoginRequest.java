package com.finsight.auth.api;
// Defines the account contact and password submitted for login.

public record PasswordLoginRequest(String channel, String email, String phone, String password) {}
