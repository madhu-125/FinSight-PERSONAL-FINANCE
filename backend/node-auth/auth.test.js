// Tests the optional Node OTP server's authentication behavior.
const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { createAuthServer } = require("./index");

const emailMessages = [];
const smsMessages = [];
let currentTime = Date.now();
let server;
let baseUrl;

before(async () => {
  server = createAuthServer({
    resendApiKey: "test-api-key",
    fromEmail: "FinSight <verified@example.com>",
    twilioAccountSid: "AC123456789",
    twilioAuthToken: "test-twilio-token",
    twilioFromNumber: "+14155550100",
    otpSecret: "a".repeat(64),
    fetchImpl: async (url, options) => {
      if (url === "https://api.resend.com/emails") {
        emailMessages.push(JSON.parse(options.body));
      } else {
        assert.equal(
          url,
          "https://api.twilio.com/2010-04-01/Accounts/AC123456789/Messages.json"
        );
        assert.equal(options.headers.Authorization, `Basic ${Buffer.from("AC123456789:test-twilio-token").toString("base64")}`);
        smsMessages.push(Object.fromEntries(new URLSearchParams(options.body)));
      }
      return { ok: true, status: 200 };
    },
    now: () => currentTime,
  });
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

async function post(path, body, headers = {}) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

test("sends an OTP, verifies it, persists a session cookie, and logs out", async () => {
  const sendResponse = await post("/api/auth/otp/send", { email: "Person@example.com" });
  assert.equal(sendResponse.status, 200);
  const sendResult = await sendResponse.json();
  assert.equal(sendResult.sent, true);
  assert.equal("code" in sendResult, false);

  const message = emailMessages[emailMessages.length - 1];
  assert.deepEqual(message.to, ["person@example.com"]);
  const code = message.text.match(/\b\d{6}\b/)[0];

  const cooldownResponse = await post("/api/auth/otp/send", { email: "person@example.com" });
  assert.equal(cooldownResponse.status, 429);

  const invalidResponse = await post("/api/auth/otp/verify", {
    email: "person@example.com",
    code: code === "000000" ? "999999" : "000000",
  });
  assert.equal(invalidResponse.status, 400);

  const verifyResponse = await post("/api/auth/otp/verify", {
    email: "person@example.com",
    code,
  });
  assert.equal(verifyResponse.status, 200);
  assert.match(verifyResponse.headers.get("set-cookie"), /HttpOnly/);
  const sessionCookie = verifyResponse.headers.get("set-cookie").split(";")[0];

  const sessionResponse = await fetch(`${baseUrl}/api/auth/session`, {
    headers: { Cookie: sessionCookie },
  });
  assert.deepEqual(await sessionResponse.json(), {
    authenticated: true,
    channel: "email",
    email: "person@example.com",
  });

  const logoutResponse = await post("/api/auth/logout", {});
  assert.match(logoutResponse.headers.get("set-cookie"), /Max-Age=0/);
  const loggedOutResponse = await fetch(`${baseUrl}/api/auth/session`);
  assert.deepEqual(await loggedOutResponse.json(), { authenticated: false });
});

test("sends and verifies an SMS OTP for an international phone number", async () => {
  const phone = "+14155550123";
  const sendResponse = await post("/api/auth/otp/send", { channel: "sms", phone });
  assert.equal(sendResponse.status, 200);
  assert.equal((await sendResponse.json()).channel, "sms");

  const message = smsMessages[smsMessages.length - 1];
  assert.equal(message.To, phone);
  assert.equal(message.From, "+14155550100");
  const code = message.Body.match(/\b\d{6}\b/)[0];
  const verifyResponse = await post("/api/auth/otp/verify", { channel: "sms", phone, code });
  assert.equal(verifyResponse.status, 200);

  const sessionCookie = verifyResponse.headers.get("set-cookie").split(";")[0];
  const sessionResponse = await fetch(`${baseUrl}/api/auth/session`, {
    headers: { Cookie: sessionCookie },
  });
  assert.deepEqual(await sessionResponse.json(), {
    authenticated: true,
    channel: "sms",
    phone,
  });
});

test("rejects SMS numbers that are not in international format", async () => {
  const response = await post("/api/auth/otp/send", { channel: "sms", phone: "4155550123" });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /international format/i);
});

test("rejects expired verification codes", async () => {
  const email = "expired@example.com";
  await post("/api/auth/otp/send", { email });
  const code = emailMessages[emailMessages.length - 1].text.match(/\b\d{6}\b/)[0];
  currentTime += 11 * 60 * 1000;

  const response = await post("/api/auth/otp/verify", { email, code });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /expired/i);
});

test("invalid verification attempts consume and invalidate the code", async () => {
  const email = "attempt-limit@example.com";
  await post("/api/auth/otp/send", { email });

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await post("/api/auth/otp/verify", { email, code: "000000" });
    assert.equal(response.status, 400);
  }

  const finalResponse = await post("/api/auth/otp/verify", { email, code: "000000" });
  assert.equal(finalResponse.status, 400);
  assert.match((await finalResponse.json()).error, /expired/i);
});
