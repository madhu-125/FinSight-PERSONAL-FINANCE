package com.finsight.auth.service;
// Delivers one-time verification codes through the configured channels.

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.finsight.auth.api.AuthException;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class OtpDeliveryService {
    private static final Logger LOGGER = LoggerFactory.getLogger(OtpDeliveryService.class);
    private static final HttpClient HTTP_CLIENT = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(10))
        .build();

    private final ObjectMapper objectMapper;
    private final String resendApiKey;
    private final String resendFromEmail;
    private final String twilioAccountSid;
    private final String twilioAuthToken;
    private final String twilioFromNumber;
    private final boolean consoleDeliveryEnabled;

    public OtpDeliveryService(
        ObjectMapper objectMapper,
        @Value("${finsight.resend.api-key:}") String resendApiKey,
        @Value("${finsight.resend.from-email:}") String resendFromEmail,
        @Value("${finsight.twilio.account-sid:}") String twilioAccountSid,
        @Value("${finsight.twilio.auth-token:}") String twilioAuthToken,
        @Value("${finsight.twilio.from-number:}") String twilioFromNumber,
        @Value("${finsight.otp.console-delivery.enabled:false}") boolean consoleDeliveryEnabled
    ) {
        this.objectMapper = objectMapper;
        this.resendApiKey = resendApiKey;
        this.resendFromEmail = resendFromEmail;
        this.twilioAccountSid = twilioAccountSid;
        this.twilioAuthToken = twilioAuthToken;
        this.twilioFromNumber = twilioFromNumber;
        this.consoleDeliveryEnabled = consoleDeliveryEnabled;
    }

    public void send(String channel, String destination, String code) {
        if (channel.equals("email")) {
            sendEmail(destination, code);
            return;
        }
        sendSms(destination, code);
    }

    private void sendEmail(String email, String code) {
        if (resendApiKey.isBlank() || resendFromEmail.isBlank()) {
            if (consoleDeliveryEnabled) {
                LOGGER.warn("Email OTP delivery fallback enabled; send an email provider is not configured.");
                LOGGER.info("Development email OTP for {}: {}", email, code);
                return;
            }
            throw new AuthException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "Email verification needs RESEND_API_KEY and a verified RESEND_FROM_EMAIL in the server .env. Restart the backend after configuring them."
            );
        }
        String text = "Your FinSight verification code is " + code + ". It expires in 10 minutes.";
        String body;
        try {
            body = objectMapper.writeValueAsString(Map.of(
                "from", resendFromEmail,
                "to", List.of(email),
                "subject", "Your FinSight verification code",
                "text", text,
                "html", "<p>Your FinSight verification code is <strong>" + code
                    + "</strong>.</p><p>It expires in 10 minutes.</p>"
            ));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Could not encode the verification email.", exception);
        }

        HttpRequest request = HttpRequest.newBuilder(URI.create("https://api.resend.com/emails"))
            .timeout(Duration.ofSeconds(15))
            .header("Authorization", "Bearer " + resendApiKey)
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .build();
        sendRequest(request, "email");
    }

    private void sendSms(String phone, String code) {
        if (twilioAccountSid.isBlank() || twilioAuthToken.isBlank() || twilioFromNumber.isBlank()) {
            if (consoleDeliveryEnabled) {
                LOGGER.warn("SMS OTP delivery fallback enabled; an SMS provider is not configured.");
                LOGGER.info("Development SMS OTP for {}: {}", phone, code);
                return;
            }
            throw new AuthException(HttpStatus.SERVICE_UNAVAILABLE, "SMS verification is not configured on this server.");
        }
        String accountPath = URLEncoder.encode(twilioAccountSid, StandardCharsets.UTF_8);
        String form = "To=" + formEncode(phone)
            + "&From=" + formEncode(twilioFromNumber)
            + "&Body=" + formEncode(
                "Your FinSight verification code is " + code + ". It expires in 10 minutes."
            );
        String credentials = Base64.getEncoder().encodeToString(
            (twilioAccountSid + ":" + twilioAuthToken).getBytes(StandardCharsets.UTF_8)
        );
        HttpRequest request = HttpRequest.newBuilder(URI.create(
                "https://api.twilio.com/2010-04-01/Accounts/" + accountPath + "/Messages.json"
            ))
            .timeout(Duration.ofSeconds(15))
            .header("Authorization", "Basic " + credentials)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .POST(HttpRequest.BodyPublishers.ofString(form))
            .build();
        sendRequest(request, "SMS");
    }

    private String formEncode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private void sendRequest(HttpRequest request, String channel) {
        try {
            HttpResponse<Void> response = HTTP_CLIENT.send(
                request,
                HttpResponse.BodyHandlers.discarding()
            );
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                LOGGER.warn("{} provider returned HTTP {}", channel, response.statusCode());
                throw new AuthException(
                    HttpStatus.BAD_GATEWAY,
                    "Could not send the verification " + channel + ". Check the delivery service configuration."
                );
            }
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            LOGGER.warn("{} provider request was interrupted", channel);
            throw new AuthException(HttpStatus.BAD_GATEWAY, "Could not send the verification " + channel + ".");
        } catch (IOException exception) {
            LOGGER.warn("{} provider request failed: {}", channel, exception.getClass().getSimpleName());
            throw new AuthException(HttpStatus.BAD_GATEWAY, "Could not send the verification " + channel + ".");
        }
    }
}
