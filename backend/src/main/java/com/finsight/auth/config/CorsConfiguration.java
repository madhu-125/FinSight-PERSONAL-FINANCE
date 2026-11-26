package com.finsight.auth.config;
// Configures which frontend origins may call the Spring API.

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfiguration implements WebMvcConfigurer {
    private final List<String> clientOrigins;

    public CorsConfiguration(@Value("${finsight.client-origin:http://localhost:3000}") String clientOrigin) {
        String normalizedOrigin = ClientOrigin.normalize(clientOrigin);
        URI origin = URI.create(normalizedOrigin);
        List<String> origins = new ArrayList<>();
        origins.add(normalizedOrigin);
        String host = origin.getHost();
        if ("localhost".equalsIgnoreCase(host) || "127.0.0.1".equals(host)) {
            String loopbackHost = "localhost".equalsIgnoreCase(host) ? "127.0.0.1" : "localhost";
            String port = origin.getPort() < 0 ? "" : ":" + origin.getPort();
            origins.add(origin.getScheme() + "://" + loopbackHost + port);
        }
        this.clientOrigins = List.copyOf(origins);
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
            .allowedOrigins(clientOrigins.toArray(new String[0]))
            .allowedOriginPatterns(
                "http://10.*:3000",
                "http://192.168.*:3000",
                "http://172.16.*:3000",
                "http://172.17.*:3000",
                "http://172.18.*:3000",
                "http://172.19.*:3000",
                "http://172.2*:3000",
                "http://172.30.*:3000",
                "http://172.31.*:3000"
            )
            .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
            .allowedHeaders("Content-Type")
            .allowCredentials(true)
            .maxAge(3600);
    }
}
