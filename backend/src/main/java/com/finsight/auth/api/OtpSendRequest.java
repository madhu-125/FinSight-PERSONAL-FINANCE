package com.finsight.auth.api;

public record OtpSendRequest(String channel, String email, String phone, String displayName) {}
