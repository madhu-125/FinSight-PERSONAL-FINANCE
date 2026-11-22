package com.finsight.auth.service;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class OtpDeliveryServiceTest {
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void consoleEmailDeliveryIsUsedWithoutAProvider() {
        OtpDeliveryService delivery = new OtpDeliveryService(
            objectMapper,
            "",
            "",
            "",
            "",
            "",
            true
        );

        assertDoesNotThrow(() -> delivery.send("email", "person@example.com", "123456"));
    }

    @Test
    void consoleSmsDeliveryIsUsedWithoutAProvider() {
        OtpDeliveryService delivery = new OtpDeliveryService(
            objectMapper,
            "",
            "",
            "",
            "",
            "",
            true
        );

        assertDoesNotThrow(() -> delivery.send("sms", "+14155550123", "123456"));
    }
}
