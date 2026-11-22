package com.finsight.auth.api;
// Defines credentials accepted only by the explicitly enabled demo login.

public record DemoLoginRequest(
    String channel,
    String email,
    String phone,
    String displayName
) {}
