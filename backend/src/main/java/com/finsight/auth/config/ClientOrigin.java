package com.finsight.auth.config;

import java.net.URI;
import java.util.Locale;

public final class ClientOrigin {
    private ClientOrigin() {}

    public static String normalize(String value) {
        String origin = value.trim();
        if (!origin.contains("://")) {
            origin = "https://" + origin;
        }

        URI uri = URI.create(origin);
        String scheme = uri.getScheme();
        String path = uri.getPath();
        if (uri.getHost() == null
            || uri.getRawUserInfo() != null
            || uri.getRawQuery() != null
            || uri.getRawFragment() != null
            || (path != null && !path.isEmpty() && !"/".equals(path))
            || (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme))) {
            throw new IllegalArgumentException("The configured client origin must be an HTTP(S) origin.");
        }

        return scheme.toLowerCase(Locale.ROOT) + "://" + uri.getRawAuthority();
    }
}
