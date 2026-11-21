package com.finsight.auth.api;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.finsight.auth.repository.AuthSessionRepository;
import com.finsight.auth.repository.OtpChallengeRepository;
import com.finsight.auth.repository.UserAccountRepository;
import com.finsight.auth.service.OtpDeliveryService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private OtpChallengeRepository challenges;

    @Autowired
    private AuthSessionRepository sessions;

    @Autowired
    private UserAccountRepository users;

    @MockitoBean
    private OtpDeliveryService delivery;

    @BeforeEach
    void clearDatabase() {
        sessions.deleteAll();
        challenges.deleteAll();
        users.deleteAll();
        reset(delivery);
    }

    @Test
    void emailOtpCreatesUserSessionAndCanBeLoggedOut() throws Exception {
        mockMvc.perform(post("/api/auth/otp/send")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"email","email":"Person@example.com"}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.sent").value(true))
            .andExpect(jsonPath("$.channel").value("email"));

        ArgumentCaptor<String> code = ArgumentCaptor.forClass(String.class);
        verify(delivery).send(eq("email"), eq("person@example.com"), code.capture());

        MvcResult verification = mockMvc.perform(post("/api/auth/otp/verify")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"email","email":"person@example.com","code":"%s","displayName":"Fin Sight User"}
                    """.formatted(code.getValue())))
            .andExpect(status().isOk())
            .andExpect(header().string("Set-Cookie", containsString("HttpOnly")))
            .andExpect(jsonPath("$.verified").value(true))
            .andReturn();

        Cookie sessionCookie = verification.getResponse().getCookie("finsight_session");
        mockMvc.perform(get("/api/auth/session").cookie(sessionCookie))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.authenticated").value(true))
            .andExpect(jsonPath("$.email").value("person@example.com"))
            .andExpect(jsonPath("$.displayName").value("Fin Sight User"));

        mockMvc.perform(post("/api/auth/logout").cookie(sessionCookie))
            .andExpect(status().isOk())
            .andExpect(header().string("Set-Cookie", containsString("Max-Age=0")));
        mockMvc.perform(get("/api/auth/session").cookie(sessionCookie))
            .andExpect(jsonPath("$.authenticated").value(false));
    }

    @Test
    void smsOtpRequiresInternationalPhoneFormat() throws Exception {
        mockMvc.perform(post("/api/auth/otp/send")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"sms","phone":"4155550123"}
                    """))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value(containsString("international format")));
    }
}
