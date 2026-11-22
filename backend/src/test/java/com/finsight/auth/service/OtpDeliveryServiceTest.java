package com.finsight.auth.service;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.finsight.auth.api.AuthException;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import java.util.Properties;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.javamail.JavaMailSender;
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
            objectProvider(),
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
            objectProvider(),
            "",
            "",
            "",
            true
        );

        assertDoesNotThrow(() -> delivery.send("sms", "+14155550123", "123456"));
    }

    @Test
    void emailDeliveryExplainsWhenNoProviderIsConfigured() {
        OtpDeliveryService delivery = delivery("", "", "", "", objectProvider(), false);
        assertThrows(AuthException.class, () -> delivery.send("email", "person@example.com", "123456"));
    }

    @Test
    void smtpEmailDeliveryUsesConfiguredSender() {
        JavaMailSender mailSender = mock(JavaMailSender.class);
        when(mailSender.createMimeMessage()).thenReturn(new MimeMessage(Session.getInstance(new Properties())));
        OtpDeliveryService delivery = delivery("", "", "smtp.example.com", "noreply@example.com",
            providerFor(mailSender), false);

        delivery.send("email", "person@example.com", "123456");

        verify(mailSender).send(org.mockito.ArgumentMatchers.any(MimeMessage.class));
    }

    private static OtpDeliveryService delivery(
        String resendApiKey,
        String resendFromEmail,
        String smtpHost,
        String mailFrom,
        ObjectProvider<JavaMailSender> mailSenderProvider,
        boolean consoleDeliveryEnabled
    ) {
        return new OtpDeliveryService(
            new ObjectMapper(),
            resendApiKey,
            resendFromEmail,
            smtpHost,
            mailFrom,
            mailSenderProvider,
            "",
            "",
            "",
            consoleDeliveryEnabled
        );
    }

    private static ObjectProvider<JavaMailSender> objectProvider() {
        return new org.springframework.beans.factory.support.StaticListableBeanFactory()
            .getBeanProvider(JavaMailSender.class);
    }

    private static ObjectProvider<JavaMailSender> providerFor(JavaMailSender mailSender) {
        org.springframework.beans.factory.support.StaticListableBeanFactory beans =
            new org.springframework.beans.factory.support.StaticListableBeanFactory();
        beans.addBean("mailSender", mailSender);
        return beans.getBeanProvider(JavaMailSender.class);
    }
}
