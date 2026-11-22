package com.finsight.auth.api;
// Verifies authentication and finance API behavior with an isolated test database.

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.finsight.auth.repository.AuthSessionRepository;
import com.finsight.auth.repository.FinanceAccountRepository;
import com.finsight.auth.repository.FinanceTransactionRepository;
import com.finsight.auth.repository.MonthlyBudgetRepository;
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
import org.springframework.security.crypto.password.PasswordEncoder;
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
    private FinanceTransactionRepository transactions;

    @Autowired
    private FinanceAccountRepository accounts;

    @Autowired
    private MonthlyBudgetRepository budgets;

    @Autowired
    private UserAccountRepository users;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @MockitoBean
    private OtpDeliveryService delivery;

    @BeforeEach
    void clearDatabase() {
        budgets.deleteAll();
        accounts.deleteAll();
        transactions.deleteAll();
        sessions.deleteAll();
        challenges.deleteAll();
        users.deleteAll();
        reset(delivery);
    }

    @Test
    void corsAllowsTheLocalhostAndLoopbackClientOrigins() throws Exception {
        mockMvc.perform(options("/api/auth/demo")
                .header("Origin", "http://127.0.0.1:3000")
                .header("Access-Control-Request-Method", "POST")
                .header("Access-Control-Request-Headers", "content-type"))
            .andExpect(status().isOk())
            .andExpect(header().string("Access-Control-Allow-Origin", "http://127.0.0.1:3000"));

        mockMvc.perform(options("/api/auth/profile")
                .header("Origin", "http://localhost:3000")
                .header("Access-Control-Request-Method", "PUT")
                .header("Access-Control-Request-Headers", "content-type"))
            .andExpect(status().isOk())
            .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:3000"))
            .andExpect(header().string("Access-Control-Allow-Methods", containsString("PUT")))
            .andExpect(header().string("Access-Control-Allow-Credentials", "true"));
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
    void tenDigitIndianMobileAddsCountryCode() throws Exception {
        mockMvc.perform(post("/api/auth/otp/send")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"sms","phone":"7337492378"}
                    """))
            .andExpect(status().isOk());

        verify(delivery).send(eq("sms"), eq("+917337492378"), org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void smsOtpCreatesUserSession() throws Exception {
        mockMvc.perform(post("/api/auth/otp/send")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"sms","phone":"+14155550123"}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.sent").value(true))
            .andExpect(jsonPath("$.channel").value("sms"));

        ArgumentCaptor<String> code = ArgumentCaptor.forClass(String.class);
        verify(delivery).send(eq("sms"), eq("+14155550123"), code.capture());
        MvcResult verification = mockMvc.perform(post("/api/auth/otp/verify")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"sms","phone":"+14155550123","code":"%s","displayName":"SMS User"}
                    """.formatted(code.getValue())))
            .andExpect(status().isOk())
            .andExpect(header().string("Set-Cookie", containsString("HttpOnly")))
            .andExpect(jsonPath("$.verified").value(true))
            .andReturn();

        Cookie sessionCookie = verification.getResponse().getCookie("finsight_session");
        mockMvc.perform(get("/api/auth/session").cookie(sessionCookie))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.authenticated").value(true))
            .andExpect(jsonPath("$.phone").value("+14155550123"))
            .andExpect(jsonPath("$.displayName").value("SMS User"));
    }

    @Test
    void otpSignupStoresOnlyAHashAndPasswordLoginCreatesASession() throws Exception {
        mockMvc.perform(post("/api/auth/otp/send")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"email","email":"password-user@example.com"}
                    """))
            .andExpect(status().isOk());

        ArgumentCaptor<String> code = ArgumentCaptor.forClass(String.class);
        verify(delivery).send(eq("email"), eq("password-user@example.com"), code.capture());
        String password = "StrongPass123!";

        mockMvc.perform(post("/api/auth/otp/verify")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"email","email":"password-user@example.com","code":"%s","displayName":"Password User","password":"%s"}
                    """.formatted(code.getValue(), password)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.displayName").value("Password User"));

        var user = users.findByChannelAndDestination("email", "password-user@example.com").orElseThrow();
        assertNotEquals(password, user.getPasswordHash());
        assertTrue(passwordEncoder.matches(password, user.getPasswordHash()));

        mockMvc.perform(post("/api/auth/password/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"email","email":"password-user@example.com","password":"incorrect-password"}
                    """))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.error").value("Email/phone or password is incorrect."));

        MvcResult login = mockMvc.perform(post("/api/auth/password/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"email","email":"password-user@example.com","password":"%s"}
                    """.formatted(password)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.authenticated").value(true))
            .andExpect(jsonPath("$.email").value("password-user@example.com"))
            .andReturn();

        Cookie sessionCookie = login.getResponse().getCookie("finsight_session");
        mockMvc.perform(put("/api/auth/profile")
                .cookie(sessionCookie)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "displayName":"Updated Name",
                      "age":31,
                      "gender":"Prefer not to say",
                      "mobileNumber":"+14155550123",
                      "address":"25 Example Street"
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.displayName").value("Updated Name"))
            .andExpect(jsonPath("$.age").value(31))
            .andExpect(jsonPath("$.gender").value("Prefer not to say"))
            .andExpect(jsonPath("$.mobileNumber").value("+14155550123"))
            .andExpect(jsonPath("$.address").value("25 Example Street"));
        mockMvc.perform(get("/api/auth/profile").cookie(sessionCookie))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.displayName").value("Updated Name"))
            .andExpect(jsonPath("$.age").value(31))
            .andExpect(jsonPath("$.mobileNumber").value("+14155550123"));
        mockMvc.perform(put("/api/auth/password")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"newPassword":"DifferentPass456!"}
                    """))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.error").value("Please sign in to continue."));
        mockMvc.perform(put("/api/auth/password")
                .cookie(sessionCookie)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"newPassword":"DifferentPass456!"}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.updated").value(true));
        mockMvc.perform(put("/api/auth/password")
                .cookie(sessionCookie)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"newPassword":"DifferentPass456!"}
                    """))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("Choose a password different from your current password."));
    }

    @Test
    void passwordResetRequiresTheOtpAndIsSingleUse() throws Exception {
        demoLogin("reset-user@example.com");
        mockMvc.perform(post("/api/auth/password/forgot")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"email","email":"reset-user@example.com"}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.sent").value(true))
            .andExpect(jsonPath("$.message").value(containsString("If an account exists")));

        ArgumentCaptor<String> code = ArgumentCaptor.forClass(String.class);
        verify(delivery).send(eq("email"), eq("reset-user@example.com"), code.capture());
        String resetRequest = """
            {"channel":"email","email":"reset-user@example.com","code":"%s","newPassword":"ResetPass123!"}
            """.formatted(code.getValue());
        mockMvc.perform(post("/api/auth/password/reset")
                .contentType(MediaType.APPLICATION_JSON)
                .content(resetRequest))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.reset").value(true));
        mockMvc.perform(post("/api/auth/password/reset")
                .contentType(MediaType.APPLICATION_JSON)
                .content(resetRequest))
            .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/auth/password/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"email","email":"reset-user@example.com","password":"ResetPass123!"}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.authenticated").value(true));
    }

    @Test
    void smsOtpAddsIndiaCountryCodeToTenDigitNumber() throws Exception {
        mockMvc.perform(post("/api/auth/otp/send")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"sms","phone":"4155550123"}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.sent").value(true));

        verify(delivery).send(eq("sms"), eq("+914155550123"), org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void transactionsRequireSessionAndAreScopedToTheSignedInUser() throws Exception {
        mockMvc.perform(get("/api/transactions"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.error").value("Please sign in to continue."));

        Cookie firstUser = demoLogin("first-user");
        mockMvc.perform(post("/api/transactions")
                .cookie(firstUser)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"description":"Lunch","category":"Food","amount":12.50,"type":"expense","transactionDate":"2026-11-21"}
                    """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.description").value("Lunch"))
            .andExpect(jsonPath("$.amount").value(12.5))
            .andExpect(jsonPath("$.type").value("expense"));

        mockMvc.perform(get("/api/transactions").cookie(firstUser))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].category").value("Food"));

        mockMvc.perform(post("/api/auth/logout").cookie(firstUser))
            .andExpect(status().isOk());
        Cookie returningUser = demoLogin("first-user");
        mockMvc.perform(get("/api/transactions").cookie(returningUser))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1));

        Cookie secondUser = demoLogin("second-user");
        mockMvc.perform(get("/api/transactions").cookie(secondUser))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void transactionsRejectAmountsWithMoreThanTwoDecimalPlaces() throws Exception {
        Cookie session = demoLogin("amount-validation");
        mockMvc.perform(post("/api/transactions")
                .cookie(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"description":"Lunch","category":"Food","amount":1.001,"type":"expense","transactionDate":"2026-11-21"}
                    """))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("Amount can have at most two decimal places."));
    }

    @Test
    void accountsAndBudgetsAreScopedToTheSignedInUser() throws Exception {
        mockMvc.perform(get("/api/accounts"))
            .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/budgets"))
            .andExpect(status().isUnauthorized());

        Cookie firstUser = demoLogin("account-owner");
        mockMvc.perform(post("/api/accounts")
                .cookie(firstUser)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"name":"Main savings","type":"savings","balance":1000.00}
                    """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.name").value("Main savings"))
            .andExpect(jsonPath("$.balance").value(1000));

        String budget = """
            {"category":"Food","amount":500.00,"month":"2026-11"}
            """;
        mockMvc.perform(post("/api/budgets")
                .cookie(firstUser)
                .contentType(MediaType.APPLICATION_JSON)
                .content(budget))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.month").value("2026-11"))
            .andExpect(jsonPath("$.amount").value(500));

        mockMvc.perform(post("/api/budgets")
                .cookie(firstUser)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"category":"Food","amount":600.00,"month":"2026-11"}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.amount").value(600));

        mockMvc.perform(get("/api/accounts").cookie(firstUser))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1));
        mockMvc.perform(get("/api/budgets").cookie(firstUser))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].amount").value(600));

        Cookie secondUser = demoLogin("other-account-owner");
        mockMvc.perform(get("/api/accounts").cookie(secondUser))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(0));
        mockMvc.perform(get("/api/budgets").cookie(secondUser))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void budgetsSupportWeeklyMonthlyAndTwoMonthPeriods() throws Exception {
        Cookie session = demoLogin("period-budget-user");
        mockMvc.perform(post("/api/budgets")
                .cookie(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"category":"Food","amount":100.00,"periodType":"WEEKLY","periodStart":"2026-11-18"}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.periodType").value("WEEKLY"))
            .andExpect(jsonPath("$.periodStart").value("2026-11-16"));

        mockMvc.perform(post("/api/budgets")
                .cookie(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"category":"Food","amount":125.00,"periodType":"WEEKLY","periodStart":"2026-11-19"}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.periodStart").value("2026-11-16"))
            .andExpect(jsonPath("$.amount").value(125));

        mockMvc.perform(post("/api/budgets")
                .cookie(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"category":"Food","amount":150.00,"periodType":"MONTHLY","periodStart":"2026-11-18"}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.periodType").value("MONTHLY"))
            .andExpect(jsonPath("$.periodStart").value("2026-11-01"));

        mockMvc.perform(post("/api/budgets")
                .cookie(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"category":"Food","amount":300.00,"periodType":"BIMONTHLY","periodStart":"2026-02-18"}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.periodType").value("BIMONTHLY"))
            .andExpect(jsonPath("$.periodStart").value("2026-01-01"));

        mockMvc.perform(get("/api/budgets").cookie(session))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(3));
    }

    @Test
    void accountAndBudgetEndpointsValidateTheirInputs() throws Exception {
        Cookie session = demoLogin("validation-user");
        mockMvc.perform(post("/api/accounts")
                .cookie(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"name":"Wallet","type":"unknown","balance":0}
                    """))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("Choose cash, checking, savings, or credit."));

        mockMvc.perform(post("/api/budgets")
                .cookie(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"category":"Food","amount":100,"month":"not-a-month"}
                    """))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("Choose a valid budget month."));
    }

    private Cookie demoLogin(String email) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/demo")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"email","email":"%s"}
                    """.formatted(email)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.authenticated").value(true))
            .andReturn();
        return result.getResponse().getCookie("finsight_session");
    }
}
