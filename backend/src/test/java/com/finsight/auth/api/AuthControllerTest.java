package com.finsight.auth.api;
// Verifies authentication and finance API behavior with an isolated test database.

import static org.hamcrest.Matchers.allOf;
import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.finsight.auth.repository.AuthSessionRepository;
import com.finsight.auth.repository.AuthHistoryRepository;
import com.finsight.auth.repository.FinanceAccountRepository;
import com.finsight.auth.repository.FinanceTransactionRepository;
import com.finsight.auth.repository.MonthlyBudgetRepository;
import com.finsight.auth.repository.OtpChallengeRepository;
import com.finsight.auth.repository.UserAccountRepository;
import com.finsight.auth.model.FinanceAccount;
import com.finsight.auth.model.FinanceTransaction;
import com.finsight.auth.model.MonthlyBudget;
import com.finsight.auth.service.OtpDeliveryService;
import jakarta.servlet.http.Cookie;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
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

@SpringBootTest(properties = "finsight.session.secure=true")
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
    private AuthHistoryRepository history;

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
        history.deleteAll();
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

        mockMvc.perform(options("/api/auth/account")
                .header("Origin", "http://localhost:3000")
                .header("Access-Control-Request-Method", "DELETE")
                .header("Access-Control-Request-Headers", "content-type"))
            .andExpect(status().isOk())
            .andExpect(header().string("Access-Control-Allow-Methods", containsString("DELETE")))
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
    void smsOtpRegistersAndSignsInWithVerifiedSessions() throws Exception {
        String phone = "+917337492378";
        mockMvc.perform(post("/api/auth/otp/send")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"sms","phone":"7337492378","flow":"signup","displayName":"Mobile User"}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.sent").value(true))
            .andExpect(jsonPath("$.channel").value("sms"));

        ArgumentCaptor<String> signupCode = ArgumentCaptor.forClass(String.class);
        verify(delivery).send(eq("sms"), eq(phone), signupCode.capture());
        MvcResult signup = mockMvc.perform(post("/api/auth/otp/verify")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"sms","phone":"7337492378","flow":"signup","displayName":"Mobile User","code":"%s"}
                    """.formatted(signupCode.getValue())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.verified").value(true))
            .andExpect(jsonPath("$.displayName").value("Mobile User"))
            .andReturn();

        var user = users.findByChannelAndDestination("sms", phone).orElseThrow();
        assertEquals("Mobile User", user.getDisplayName());

        reset(delivery);
        mockMvc.perform(post("/api/auth/otp/send")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"sms","phone":"7337492378","flow":"login"}
                    """))
            .andExpect(status().isOk());

        ArgumentCaptor<String> loginCode = ArgumentCaptor.forClass(String.class);
        verify(delivery).send(eq("sms"), eq(phone), loginCode.capture());
        MvcResult login = mockMvc.perform(post("/api/auth/otp/verify")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"sms","phone":"7337492378","flow":"login","code":"%s"}
                    """.formatted(loginCode.getValue())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.verified").value(true))
            .andExpect(jsonPath("$.displayName").value("Mobile User"))
            .andReturn();

        mockMvc.perform(get("/api/auth/session")
                .cookie(signup.getResponse().getCookie("finsight_session")))
            .andExpect(jsonPath("$.authenticated").value(true))
            .andExpect(jsonPath("$.phone").value(phone));
        mockMvc.perform(get("/api/auth/session")
                .cookie(login.getResponse().getCookie("finsight_session")))
            .andExpect(jsonPath("$.authenticated").value(true))
            .andExpect(jsonPath("$.phone").value(phone));
    }

    @Test
    void smsLoginRequiresAnExistingAccountAndPasswordRecoveryRemainsEmailOnly() throws Exception {
        mockMvc.perform(post("/api/auth/otp/send")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"sms","phone":"7337492378","flow":"login"}
                    """))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.error").value("No account exists for this mobile number. Sign up first."));

        mockMvc.perform(post("/api/auth/password/forgot")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"sms","phone":"+14155550123"}
                    """))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("OTP verification is available by email only."));

        mockMvc.perform(post("/api/auth/password/reset")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"sms","phone":"+14155550123","code":"123456","newPassword":"ResetPass123!"}
                    """))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("OTP verification is available by email only."));

        verify(delivery, never()).send(anyString(), anyString(), anyString());
    }

    @Test
    void passwordRegistrationCreatesEmailAccountWithoutSendingOtp() throws Exception {
        String password = "StrongPass123!";
        MvcResult registration = mockMvc.perform(post("/api/auth/password/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"email","email":"new-user@example.com","displayName":"New User","password":"%s"}
                    """.formatted(password)))
            .andExpect(status().isOk())
            .andExpect(header().string("Set-Cookie", allOf(
                containsString("HttpOnly"),
                containsString("Secure"),
                containsString("SameSite=None")
            )))
            .andExpect(jsonPath("$.authenticated").value(true))
            .andExpect(jsonPath("$.email").value("new-user@example.com"))
            .andExpect(jsonPath("$.displayName").value("New User"))
            .andReturn();

        verify(delivery, never()).send(anyString(), anyString(), anyString());
        var user = users.findByChannelAndDestination("email", "new-user@example.com").orElseThrow();
        assertNotEquals(password, user.getPasswordHash());
        assertTrue(passwordEncoder.matches(password, user.getPasswordHash()));

        Cookie sessionCookie = registration.getResponse().getCookie("finsight_session");
        mockMvc.perform(get("/api/auth/session").cookie(sessionCookie))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.authenticated").value(true))
            .andExpect(jsonPath("$.email").value("new-user@example.com"));

        mockMvc.perform(post("/api/auth/password/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"email","email":"new-user@example.com","displayName":"New User","password":"%s"}
                    """.formatted(password)))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.error").value(containsString("already exists")));
    }

    @Test
    void loginHistoryTracksSuccessfulLoginAndLogoutForTheSignedInAccount() throws Exception {
        String password = "StrongPass123!";
        MvcResult registration = mockMvc.perform(post("/api/auth/password/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"email","email":"history-user@example.com","displayName":"History User","password":"%s"}
                    """.formatted(password)))
            .andExpect(status().isOk())
            .andReturn();
        Cookie registrationCookie = registration.getResponse().getCookie("finsight_session");

        mockMvc.perform(get("/api/auth/history").cookie(registrationCookie))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].eventType").value("LOGIN"));

        mockMvc.perform(post("/api/auth/logout").cookie(registrationCookie))
            .andExpect(status().isOk());

        MvcResult login = mockMvc.perform(post("/api/auth/password/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"email","email":"history-user@example.com","password":"%s"}
                    """.formatted(password)))
            .andExpect(status().isOk())
            .andReturn();

        mockMvc.perform(get("/api/auth/history").cookie(login.getResponse().getCookie("finsight_session")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].eventType").value("LOGIN"))
            .andExpect(jsonPath("$[1].eventType").value("LOGOUT"))
            .andExpect(jsonPath("$[2].eventType").value("LOGIN"));
    }

    @Test
    void deletingAccountRemovesOnlyItsFinancialAndAuthenticationData() throws Exception {
        String password = "StrongPass123!";
        MvcResult firstRegistration = mockMvc.perform(post("/api/auth/password/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"email","email":"delete-me@example.com","displayName":"Delete Me","password":"%s"}
                    """.formatted(password)))
            .andExpect(status().isOk())
            .andReturn();
        MvcResult secondRegistration = mockMvc.perform(post("/api/auth/password/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"email","email":"keep-me@example.com","displayName":"Keep Me","password":"%s"}
                    """.formatted(password)))
            .andExpect(status().isOk())
            .andReturn();

        var firstUser = users.findByChannelAndDestination("email", "delete-me@example.com").orElseThrow();
        var secondUser = users.findByChannelAndDestination("email", "keep-me@example.com").orElseThrow();
        Instant now = Instant.now();
        LocalDate today = LocalDate.now();
        transactions.save(new FinanceTransaction(
            firstUser.getId(), "First expense", "Food", new BigDecimal("12.00"), "expense", today, now
        ));
        transactions.save(new FinanceTransaction(
            secondUser.getId(), "Second expense", "Food", new BigDecimal("15.00"), "expense", today, now
        ));
        accounts.save(new FinanceAccount(
            firstUser.getId(), "First account", "BANK", new BigDecimal("100.00"), now
        ));
        accounts.save(new FinanceAccount(
            secondUser.getId(), "Second account", "BANK", new BigDecimal("200.00"), now
        ));
        budgets.save(new MonthlyBudget(
            firstUser.getId(), "Food", new BigDecimal("100.00"), "MONTHLY", today.withDayOfMonth(1), now
        ));
        budgets.save(new MonthlyBudget(
            secondUser.getId(), "Food", new BigDecimal("120.00"), "MONTHLY", today.withDayOfMonth(1), now
        ));

        mockMvc.perform(delete("/api/auth/account")
                .cookie(firstRegistration.getResponse().getCookie("finsight_session")))
            .andExpect(status().isOk())
            .andExpect(header().string("Set-Cookie", containsString("Max-Age=0")))
            .andExpect(jsonPath("$.deleted").value(true));

        assertFalse(users.existsById(firstUser.getId()));
        assertTrue(users.existsById(secondUser.getId()));
        assertEquals(0, transactions.findByUserIdOrderByTransactionDateDescIdDesc(firstUser.getId()).size());
        assertEquals(1, transactions.findByUserIdOrderByTransactionDateDescIdDesc(secondUser.getId()).size());
        assertEquals(0, accounts.findByUserIdOrderByNameAsc(firstUser.getId()).size());
        assertEquals(1, accounts.findByUserIdOrderByNameAsc(secondUser.getId()).size());
        assertEquals(0, budgets.findByUserIdOrderByPeriodStartDescCategoryAsc(firstUser.getId()).size());
        assertEquals(1, budgets.findByUserIdOrderByPeriodStartDescCategoryAsc(secondUser.getId()).size());

        mockMvc.perform(get("/api/auth/session")
                .cookie(firstRegistration.getResponse().getCookie("finsight_session")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.authenticated").value(false));
        mockMvc.perform(get("/api/auth/history")
                .cookie(secondRegistration.getResponse().getCookie("finsight_session")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].eventType").value("LOGIN"));
    }

    @Test
    void passwordRegistrationAndLoginRejectMobileNumbers() throws Exception {
        String password = "StrongPass123!";
        mockMvc.perform(post("/api/auth/password/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"sms","phone":"7337492378","displayName":"Mobile User","password":"%s"}
                    """.formatted(password)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("Phone sign-in and registration require a verification code."));

        mockMvc.perform(post("/api/auth/password/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"channel":"sms","phone":"7337492378","password":"%s"}
                    """.formatted(password)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("Phone sign-in and registration require a verification code."));

        verify(delivery, never()).send(anyString(), anyString(), anyString());
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
                      "address":"25 Example Street",
                      "monthlyIncome":82500.50,
                      "occupation":"Product designer",
                      "currency":"INR",
                      "savingsGoals":["Build an emergency fund","Grow investments"]
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.displayName").value("Updated Name"))
            .andExpect(jsonPath("$.age").value(31))
            .andExpect(jsonPath("$.gender").value("Prefer not to say"))
            .andExpect(jsonPath("$.mobileNumber").value("+14155550123"))
            .andExpect(jsonPath("$.address").value("25 Example Street"))
            .andExpect(jsonPath("$.monthlyIncome").value(82500.50))
            .andExpect(jsonPath("$.occupation").value("Product designer"))
            .andExpect(jsonPath("$.currency").value("INR"))
            .andExpect(jsonPath("$.savingsGoals[0]").value("Build an emergency fund"))
            .andExpect(jsonPath("$.savingsGoals[1]").value("Grow investments"));
        mockMvc.perform(get("/api/auth/profile").cookie(sessionCookie))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.displayName").value("Updated Name"))
            .andExpect(jsonPath("$.age").value(31))
            .andExpect(jsonPath("$.mobileNumber").value("+14155550123"))
            .andExpect(jsonPath("$.monthlyIncome").value(82500.50))
            .andExpect(jsonPath("$.occupation").value("Product designer"))
            .andExpect(jsonPath("$.currency").value("INR"))
            .andExpect(jsonPath("$.savingsGoals[1]").value("Grow investments"));
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

        mockMvc.perform(delete("/api/transactions"))
            .andExpect(status().isUnauthorized());
        mockMvc.perform(delete("/api/transactions").cookie(returningUser))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.deleted").value(true))
            .andExpect(jsonPath("$.count").value(1));
        mockMvc.perform(get("/api/transactions").cookie(returningUser))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(0));
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
