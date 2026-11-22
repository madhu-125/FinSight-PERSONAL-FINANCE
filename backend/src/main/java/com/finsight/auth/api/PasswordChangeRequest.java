package com.finsight.auth.api;
// Defines the replacement password for an authenticated update.

public record PasswordChangeRequest(String newPassword) {}
