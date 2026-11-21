package com.finsight.auth.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfiguration implements WebMvcConfigurer {
    private final String clientOrigin;

    public CorsConfiguration(@Value("${finsight.client-origin:http://localhost:3000}") String clientOrigin) {
        this.clientOrigin = clientOrigin;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
            .allowedOrigins(clientOrigin)
            .allowedMethods("GET", "POST", "OPTIONS")
            .allowedHeaders("Content-Type")
            .allowCredentials(true)
            .maxAge(3600);
    }
}
