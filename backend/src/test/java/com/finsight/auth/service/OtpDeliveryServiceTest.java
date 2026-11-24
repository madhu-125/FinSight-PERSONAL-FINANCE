package com.finsight.auth.service;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
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
            true
        );

        assertDoesNotThrow(() -> delivery.send("email", "person@example.com", "123456"));
    }

    @Test
    void smsOtpDeliveryIsRejected() {
        OtpDeliveryService delivery = new OtpDeliveryService(
            objectMapper,
            "",
            "",
            "",
            "",
            objectProvider(),
            true
        );

        AuthException exception = assertThrows(
            AuthException.class,
            () -> delivery.send("sms", "+14155550123", "123456")
        );
        assertEquals("OTP verification is available by email only.", exception.getMessage());
    }

    @Test
    void emailDeliveryExplainsWhenNoProviderIsConfigured() {
        OtpDeliveryService delivery = delivery("", "", "", "", objectProvider(), false);
        assertThrows(AuthException.class, () -> delivery.send("email", "person@example.com", "123456"));
    }

    @Test
    void resendForbiddenErrorExplainsSenderDomainRequirement() {
        assertEquals(
            "Resend rejected the email. Verify a sending domain and use an address from that domain in RESEND_FROM_EMAIL. The onboarding@resend.dev sender is limited to Resend testing.",
            OtpDeliveryService.providerFailureMessage("email", 403)
        );
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

    @Test
    void configuredSmtpTakesPrecedenceOverResend() {
        JavaMailSender mailSender = mock(JavaMailSender.class);
        when(mailSender.createMimeMessage()).thenReturn(new MimeMessage(Session.getInstance(new Properties())));
        OtpDeliveryService delivery = delivery(
            "resend-key",
            "FinSight <verified@example.com>",
            "smtp.gmail.com",
            "noreply@example.com",
            providerFor(mailSender),
            false
        );

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
