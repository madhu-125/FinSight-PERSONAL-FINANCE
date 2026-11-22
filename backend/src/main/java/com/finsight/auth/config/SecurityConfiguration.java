package com.finsight.auth.config;

import com.finsight.auth.service.GoogleLoginSuccessHandler;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfiguration {
    @Bean
    ClientRegistrationRepository clientRegistrationRepository(
        @Value("${finsight.google.client-id:}") String clientId,
        @Value("${finsight.google.client-secret:}") String clientSecret
    ) {
        if (clientId.isBlank() || clientSecret.isBlank()) {
            return registrationId -> null;
        }

        ClientRegistration google = ClientRegistration.withRegistrationId("google")
            .clientId(clientId)
            .clientSecret(clientSecret)
            .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
            .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
            .redirectUri("{baseUrl}/login/oauth2/code/{registrationId}")
            .scope("openid", "profile", "email")
            .authorizationUri("https://accounts.google.com/o/oauth2/v2/auth")
            .tokenUri("https://oauth2.googleapis.com/token")
            .userInfoUri("https://www.googleapis.com/oauth2/v3/userinfo")
            .userNameAttributeName("sub")
            .clientName("Google")
            .build();
        return new InMemoryClientRegistrationRepository(google);
    }

    @Bean
    SecurityFilterChain applicationSecurity(
        HttpSecurity http,
        GoogleLoginSuccessHandler successHandler,
        @Value("${finsight.client-origin:http://localhost:3000}") String clientOrigin
    ) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .authorizeHttpRequests(authorize -> authorize.anyRequest().permitAll())
            .oauth2Login(oauth -> oauth
                .successHandler(successHandler)
                .failureHandler((request, response, exception) ->
                    response.sendRedirect(clientOrigin + "/?oauthError=google_login_failed")
                )
            );
        return http.build();
    }
}
