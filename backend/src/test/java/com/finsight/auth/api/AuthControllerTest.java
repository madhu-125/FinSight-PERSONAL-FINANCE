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
