// Runs the optional Node-based OTP server when the Spring API is not used.
const http = require("node:http");
const { createHmac, randomInt, timingSafeEqual } = require("node:crypto");

const OTP_LIFETIME_MS = 10 * 60 * 1000;
const OTP_RESEND_DELAY_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const SESSION_LIFETIME_SECONDS = 365 * 24 * 60 * 60;
const AUTH_COOKIE_NAME = "finsight_session";
const MAX_BODY_BYTES = 16 * 1024;

function sendJson(response, status, body, headers = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
  response.end(JSON.stringify(body));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;

    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
        return;
      }
      chunks.push(chunk);
    });

    request.on("end", () => {
      if (tooLarge) {
        const error = new Error("Request body is too large.");
        error.statusCode = 413;
        reject(error);
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        const error = new Error("Request body must be valid JSON.");
        error.statusCode = 400;
        reject(error);
      }
    });

    request.on("error", reject);
  });
}

function normalizeEmail(value) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function normalizePhone(value) {
  if (typeof value !== "string") return null;
  const phone = value.trim();
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}

function createCodeHash(challengeKey, code, secret) {
  return createHmac("sha256", secret).update(`${challengeKey}:${code}`).digest();
}

function createSessionToken(channel, destination, secret, now) {
  const payload = Buffer.from(JSON.stringify({
    channel,
    [channel === "email" ? "email" : "phone"]: destination,
    expiresAt: now + SESSION_LIFETIME_SECONDS * 1000,
  })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function getSession(request, secret, now) {
  const cookieHeader = request.headers.cookie || "";
  const token = cookieHeader.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${AUTH_COOKIE_NAME}=`))
    ?.slice(AUTH_COOKIE_NAME.length + 1);
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expectedSignature = createHmac("sha256", secret).update(payload).digest();
  const actualSignature = Buffer.from(signature, "base64url");
  if (actualSignature.length !== expectedSignature.length
    || !timingSafeEqual(actualSignature, expectedSignature)) {
    return null;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const hasValidIdentity = (session.channel === "email" && typeof session.email === "string")
      || (session.channel === "sms" && typeof session.phone === "string");
    if (!hasValidIdentity || session.expiresAt <= now) return null;
    return session;
  } catch {
    return null;
  }
}

function createAuthServer({
  resendApiKey,
  fromEmail,
  twilioAccountSid,
  twilioAuthToken,
  twilioFromNumber,
  otpSecret,
  clientOrigin = "http://localhost:3000",
  fetchImpl = fetch,
  now = Date.now,
}) {
  if (!otpSecret || otpSecret.length < 32) {
    throw new Error("An OTP_SECRET of at least 32 characters is required.");
  }

  const challenges = new Map();
  const secureCookie = process.env.NODE_ENV === "production" ? "; Secure" : "";

  const server = http.createServer(async (request, response) => {
    const origin = request.headers.origin;
    if (origin && origin === clientOrigin) {
      response.setHeader("Access-Control-Allow-Origin", clientOrigin);
      response.setHeader("Access-Control-Allow-Credentials", "true");
      response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      response.setHeader("Access-Control-Allow-Headers", "Content-Type");
      response.setHeader("Vary", "Origin");
    }

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    const { pathname } = new URL(request.url, "http://localhost");
    if (request.method === "GET" && pathname === "/api/auth/session") {
      const session = getSession(request, otpSecret, now());
      sendJson(response, 200, session
        ? {
          authenticated: true,
          channel: session.channel,
          ...(session.channel === "email" ? { email: session.email } : { phone: session.phone }),
        }
        : { authenticated: false });
      return;
    }

    if (request.method === "POST" && pathname === "/api/auth/logout") {
      sendJson(response, 200, { loggedOut: true }, {
        "Set-Cookie": `${AUTH_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureCookie}`,
      });
      return;
    }

    if (request.method !== "POST"
      || (pathname !== "/api/auth/otp/send" && pathname !== "/api/auth/otp/verify")) {
      sendJson(response, 404, { error: "Endpoint not found." });
      return;
    }

    let body;
    try {
      body = await readJson(request);
    } catch (error) {
      sendJson(response, error.statusCode || 400, { error: error.message });
      return;
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      sendJson(response, 400, { error: "Request body must be a JSON object." });
      return;
    }

    const channel = body.channel || "email";
    if (channel !== "email" && channel !== "sms") {
      sendJson(response, 400, { error: "Choose email or SMS verification." });
      return;
    }

    const destination = channel === "email"
      ? normalizeEmail(body.email)
      : normalizePhone(body.phone);
    if (!destination) {
      sendJson(response, 400, {
        error: channel === "email"
          ? "Enter a valid email address."
          : "Enter a valid phone number in international format, such as +14155550123.",
      });
      return;
    }

    const challengeKey = `${channel}:${destination}`;
    if (pathname === "/api/auth/otp/send") {
      const existingChallenge = challenges.get(challengeKey);
      const currentTime = now();
      if (existingChallenge && existingChallenge.resendAt > currentTime) {
        sendJson(response, 429, {
          error: "Please wait before requesting another code.",
          retryAfterSeconds: Math.ceil((existingChallenge.resendAt - currentTime) / 1000),
        });
        return;
      }

      const code = String(randomInt(100000, 1000000));
      let providerResponse;
      try {
        if (channel === "email") {
          if (!resendApiKey || !fromEmail) {
            sendJson(response, 503, { error: "Email verification is not configured on this server." });
            return;
          }
          providerResponse = await fetchImpl("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: fromEmail,
              to: [destination],
              subject: "Your FinSight verification code",
              text: `Your FinSight verification code is ${code}. It expires in 10 minutes.`,
              html: `<p>Your FinSight verification code is <strong>${code}</strong>.</p><p>It expires in 10 minutes.</p>`,
            }),
          });
        } else {
          if (!twilioAccountSid || !twilioAuthToken || !twilioFromNumber) {
            sendJson(response, 503, { error: "SMS verification is not configured on this server." });
            return;
          }
          const credentials = Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString("base64");
          const message = new URLSearchParams({
            To: destination,
            From: twilioFromNumber,
            Body: `Your FinSight verification code is ${code}. It expires in 10 minutes.`,
          });
          providerResponse = await fetchImpl(
            `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(twilioAccountSid)}/Messages.json`,
            {
              method: "POST",
              headers: {
                Authorization: `Basic ${credentials}`,
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: message.toString(),
            }
          );
        }
      } catch (error) {
        console.error(`${channel === "email" ? "Resend" : "Twilio"} request failed:`, error.message);
        sendJson(response, 502, {
          error: `Could not send the verification ${channel === "email" ? "email" : "SMS"}. Please try again.`,
        });
        return;
      }

      if (!providerResponse.ok) {
        console.error(`${channel === "email" ? "Resend" : "Twilio"} request failed with status:`, providerResponse.status);
        sendJson(response, 502, {
          error: `Could not send the verification ${channel === "email" ? "email" : "SMS"}. Check the ${channel === "email" ? "email" : "SMS"} service configuration.`,
        });
        return;
      }

      challenges.set(challengeKey, {
        codeHash: createCodeHash(challengeKey, code, otpSecret),
        expiresAt: currentTime + OTP_LIFETIME_MS,
        resendAt: currentTime + OTP_RESEND_DELAY_MS,
        attempts: 0,
      });
      sendJson(response, 200, {
        sent: true,
        channel,
        expiresInSeconds: OTP_LIFETIME_MS / 1000,
        resendAfterSeconds: OTP_RESEND_DELAY_MS / 1000,
      });
      return;
    }

    const code = typeof body.code === "string" ? body.code : "";
    if (!/^\d{6}$/.test(code)) {
      sendJson(response, 400, { error: "Enter the 6-digit verification code." });
      return;
    }

    const challenge = challenges.get(challengeKey);
    if (!challenge || challenge.expiresAt <= now()) {
      challenges.delete(challengeKey);
      sendJson(response, 400, { error: "This code has expired. Request a new code." });
      return;
    }

    const candidateHash = createCodeHash(challengeKey, code, otpSecret);
    if (!timingSafeEqual(candidateHash, challenge.codeHash)) {
      challenge.attempts += 1;
      if (challenge.attempts >= OTP_MAX_ATTEMPTS) challenges.delete(challengeKey);
      sendJson(response, 400, {
        error: challenge.attempts >= OTP_MAX_ATTEMPTS
          ? "Too many incorrect attempts. Request a new code."
          : "That verification code is incorrect.",
      });
      return;
    }

    challenges.delete(challengeKey);
    const token = createSessionToken(channel, destination, otpSecret, now());
    sendJson(response, 200, { verified: true, channel }, {
      "Set-Cookie": `${AUTH_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_LIFETIME_SECONDS}${secureCookie}`,
    });
  });

  return server;
}

function startServer() {
  const {
    RESEND_API_KEY,
    RESEND_FROM_EMAIL,
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_FROM_NUMBER,
    OTP_SECRET,
  } = process.env;
  const hasEmailProvider = RESEND_API_KEY && RESEND_FROM_EMAIL;
  const hasSmsProvider = TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER;
  if ((!hasEmailProvider && !hasSmsProvider) || !OTP_SECRET || OTP_SECRET.length < 32) {
    console.error("Configure at least one OTP delivery provider and an OTP_SECRET of at least 32 characters in .env.");
    process.exitCode = 1;
    return;
  }

  const server = createAuthServer({
    resendApiKey: RESEND_API_KEY,
    fromEmail: RESEND_FROM_EMAIL,
    twilioAccountSid: TWILIO_ACCOUNT_SID,
    twilioAuthToken: TWILIO_AUTH_TOKEN,
    twilioFromNumber: TWILIO_FROM_NUMBER,
    otpSecret: OTP_SECRET,
    clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:3000",
  });
  const port = Number(process.env.PORT) || 4000;
  server.listen(port, () => {
    console.log(`FinSight authentication server listening on port ${port}.`);
  });
}

if (require.main === module) startServer();

module.exports = { createAuthServer };
