package com.finsight.auth.api;

public record DemoLoginRequest(
    String channel,
    String email,
    String phone,
    String displayName
) {}
