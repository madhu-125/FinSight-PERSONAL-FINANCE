// Renders account sign-in, registration, and verification flows.
import React, { useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "./apiBaseUrl";
import "./Login.css";

async function parseApiResponse(response) {
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("The authentication server returned an invalid response.");
  }
  if (!response.ok) {
    const error = new Error(result.error || "The request could not be completed.");
    error.retryAfterSeconds = result.retryAfterSeconds;
    throw error;
  }
  return result;
}

function getPhoneNumber(phone) {
  return phone.length === 10 ? `+91${phone}` : phone;
}

export function PullLamp({ lampOn, onPull, className = "", ariaLabel, caption = "PULL THE CORD" }) {
  const dragStartY = useRef(null);
  const suppressClick = useRef(false);

  const handlePointerDown = (event) => {
    dragStartY.current = event.clientY;
    if (event.currentTarget.setPointerCapture) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };

  const handlePointerUp = (event) => {
    if (dragStartY.current === null) return;
    const pulledDistance = event.clientY - dragStartY.current;
    dragStartY.current = null;
    if (pulledDistance >= 24) {
      suppressClick.current = true;
      onPull();
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 0);
    }
  };

  const handleClick = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    onPull();
  };

  return (
    <div className={`lumi-lamp-area ${className} ${lampOn ? "lamp-on" : ""}`}>
      <div className="lumi-lamp-glow" />
      <div className="lumi-lamp">
        <div className="lumi-lamp-base" />
        <div className="lumi-lamp-stand" />
        <div className="lumi-lamp-joint" />
        <div className="lumi-lamp-arm" />
        <div className="lumi-lamp-joint top" />
        <div className="lumi-lamp-shade">
          <div className="lumi-shade-inner" />
          <div className="lumi-bulb" />
        </div>
        <div className="lumi-light-beam" />
        <button
          className="lumi-pull-cord"
          type="button"
          aria-label={ariaLabel || "Pull the cord to turn the lamp on"}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => {
            dragStartY.current = null;
          }}
          onClick={handleClick}
        >
          <span className="lumi-cord-line" />
          <span className="lumi-cord-knob" />
        </button>
      </div>
      <p className="lumi-lamp-caption">{caption}</p>
    </div>
  );
}

export default function Login({ onLogin, onBackToLanding }) {
  const [signupMode, setSignupMode] = useState(false);
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [resetOtpSent, setResetOtpSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [toast, setToast] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [otpChannel, setOtpChannel] = useState("email");
  const [phone, setPhone] = useState("");
  const [smsOtpSent, setSmsOtpSent] = useState(false);
  const [smsCode, setSmsCode] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const canvasRef = useRef(null);
  const toastTimer = useRef(null);

  const showToast = (message) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 3000);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    let frameId;
    let particles = [];

    const resizeCanvas = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * ratio;
      canvas.height = window.innerHeight * ratio;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      particles = Array.from({ length: 84 }, () => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        size: Math.random() * 1.1 + 0.65,
        speed: Math.random() * 0.4 + 0.1,
        opacity: Math.random() * 0.16 + 0.07,
      }));
    };

    const animate = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      particles.forEach((particle) => {
        particle.y -= particle.speed;
        particle.x += Math.sin(particle.y * 0.01) * 0.2;
        if (particle.y < 0) {
          particle.y = window.innerHeight;
          particle.x = Math.random() * window.innerWidth;
        }
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(190, 195, 255, ${particle.opacity})`;
        ctx.shadowBlur = 5;
        ctx.shadowColor = "rgba(130,125,255,0.24)";
        ctx.fill();
      });
      frameId = window.requestAnimationFrame(animate);
    };

    resizeCanvas();
    animate();
    window.addEventListener("resize", resizeCanvas);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resizeCanvas);
      window.clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    if (resendSeconds <= 0) return undefined;
    const countdownTimer = window.setTimeout(
      () => setResendSeconds((seconds) => Math.max(0, seconds - 1)),
      1000
    );
    return () => window.clearTimeout(countdownTimer);
  }, [resendSeconds]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const oauthError = url.searchParams.get("oauthError");
    if (!oauthError) return;

    const messages = {
      google_not_configured: "Google sign-in is not configured on the server yet.",
      google_email_unverified: "Google sign-in requires a verified Google email address.",
      google_login_failed: "Google sign-in could not be completed. Please try again.",
    };
    setAuthError(messages[oauthError] || "Social sign-in could not be completed.");
    url.searchParams.delete("oauthError");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  const requestPasswordReset = async (event) => {
    event?.preventDefault();
    setAuthError("");
    setIsResettingPassword(true);
    try {
      await parseApiResponse(await fetch(`${API_BASE_URL}/api/auth/password/forgot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ channel: "email", email }),
      }));
      setResetOtpSent(true);
      setResetCode("");
      setResendSeconds(60);
      showToast("If an account exists, a reset code has been sent.");
    } catch (error) {
      if (error.retryAfterSeconds) setResendSeconds(error.retryAfterSeconds);
      setAuthError(
        otpChannel === "email" && error.message.includes("Email delivery is not configured")
          ? "This app cannot send reset emails yet. Ask the administrator to configure a verified email sender or SMTP service."
          : error.message
      );
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handlePasswordReset = async (event) => {
    event.preventDefault();
    setAuthError("");
    if (newPassword.length < 8) {
      setAuthError("Use at least 8 characters for your new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setAuthError("The new passwords do not match.");
      return;
    }

    setIsResettingPassword(true);
    try {
      await parseApiResponse(await fetch(`${API_BASE_URL}/api/auth/password/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          channel: "email",
          email,
          code: resetCode,
          newPassword,
        }),
      }));
      setForgotPasswordMode(false);
      setResetOtpSent(false);
      setPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setResetCode("");
      showToast("Password updated. Sign in with your new password.");
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setIsResettingPassword(false);
    }
  };

  const sendPhoneOtp = async () => {
    setAuthError("");
    setIsSubmittingAuth(true);
    try {
      const result = await parseApiResponse(await fetch(`${API_BASE_URL}/api/auth/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          channel: "sms",
          phone: getPhoneNumber(phone),
          flow: signupMode ? "signup" : "login",
          ...(signupMode ? { displayName: name.trim() } : {}),
        }),
      }));
      setSmsOtpSent(true);
      setSmsCode("");
      setResendSeconds(result.resendAfterSeconds || 60);
      showToast(`A verification code was sent to ${getPhoneNumber(phone)}.`);
    } catch (error) {
      if (error.retryAfterSeconds) setResendSeconds(error.retryAfterSeconds);
      setAuthError(error.message);
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const verifyPhoneOtp = async () => {
    setAuthError("");
    setIsSubmittingAuth(true);
    try {
      const result = await parseApiResponse(await fetch(`${API_BASE_URL}/api/auth/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          channel: "sms",
          phone: getPhoneNumber(phone),
          code: smsCode,
          flow: signupMode ? "signup" : "login",
          ...(signupMode ? { displayName: name.trim() } : {}),
        }),
      }));
      completeLogin(result);
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const completeLogin = (result) => {
    onLogin?.({
      name: result.displayName || (otpChannel === "email" ? email.split("@")[0] : phone) || "there",
      email: otpChannel === "email" ? email : "",
      phone: otpChannel === "sms" ? getPhoneNumber(phone) : "",
      channel: otpChannel,
      remember,
      isNewAccount: signupMode,
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (signupMode && !name.trim()) {
      setAuthError("Please enter your name.");
      return;
    }
    if (otpChannel === "sms") {
      if (smsOtpSent) {
        await verifyPhoneOtp();
      } else {
        await sendPhoneOtp();
      }
      return;
    }
    if (signupMode && password.length < 8) {
      setAuthError("Use at least 8 characters for your password.");
      return;
    }
    if (signupMode && password !== signupConfirmPassword) {
      setAuthError("Passwords do not match.");
      return;
    }
    const recipient = otpChannel === "email" ? { email } : { phone: getPhoneNumber(phone) };
    setIsSubmittingAuth(true);
    setAuthError("");
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/auth/password/${signupMode ? "register" : "login"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            channel: otpChannel,
            ...recipient,
            ...(signupMode ? { displayName: name.trim() } : {}),
            password,
          }),
        }
      );
      const result = await parseApiResponse(response);
      completeLogin(result);
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  return (
    <div className={`lumi-login ${signupMode ? "signup-mode" : ""}`}>
      <canvas className="lumi-particles" ref={canvasRef} aria-hidden="true" />
      <main className="lumi-scene">
        <button className="lumi-back-button" type="button" onClick={onBackToLanding}>
          ← Back
        </button>
        <section className="lumi-finance-hero" aria-label="FinSight personal finance overview">
          <div className="lumi-hero-brand">
            <span className="lumi-hero-mark" aria-hidden="true"><i /><i /><i /></span>
            <span>Fin<span>Sight</span><sup>™</sup></span>
          </div>
          <p className="lumi-hero-kicker">PERSONAL FINANCE</p>
          <div className="lumi-hero-rule" />
          <p className="lumi-hero-motto">Plan <b>•</b> Track <b>•</b> Grow</p>
          <h2>Take control of your money,<br /><em>build a better tomorrow.</em></h2>
          <div className="lumi-hero-features">
            <span><b>◔</b> Budget</span>
            <span><b>↗</b> Track</span>
            <span><b>▣</b> Save</span>
            <span><b>◎</b> Achieve</span>
          </div>
          <div className="lumi-money-scene" aria-hidden="true">
            <div className="lumi-rise-arrow" />
            <div className="lumi-city-bars"><i /><i /><i /><i /><i /></div>
            <div className="lumi-phone">
              <div className="lumi-phone-notch" />
              <strong>FinSight</strong>
              <small>Total Balance</small>
              <b>₹75,890</b>
              <div className="lumi-phone-chart"><i /><i /><i /><i /><i /></div>
              <small>Monthly spending</small>
              <div className="lumi-phone-donut" />
            </div>
            <div className="lumi-notebook"><span>Dream big...</span><b>Plan smart.</b><i /></div>
            <div className="lumi-pig"><span className="lumi-pig-ear" /><span className="lumi-pig-ear right" /><b>◡</b><i>•</i></div>
            <div className="lumi-coins"><i /><i /><i /><i /><i /></div>
            <div className="lumi-rupee-coin">₹</div>
          </div>
        </section>
        <section className="lumi-login-card">
          <div className="lumi-card-header">
            <span className="lumi-brand-icon">✦</span>
            <p className="lumi-brand">FINSIGHT</p>
            <h1>
              {forgotPasswordMode
                ? resetOtpSent ? "Choose a new password" : "Reset your password"
                : signupMode ? "Create account" : "Welcome back"}
            </h1>
            <p className="lumi-subtitle">
              {forgotPasswordMode
                ? resetOtpSent
                  ? `Enter the code sent to ${email}, then choose a new password.`
                  : "Email reset codes are available only for accounts registered with that email address."
                : signupMode
                    ? otpChannel === "sms"
                      ? smsOtpSent
                        ? `Enter the verification code sent to ${getPhoneNumber(phone)} to finish creating your account.`
                        : "Create your account with your mobile number. We will text you a verification code."
                      : "Create an account with your email and password."
                    : otpChannel === "sms"
                      ? smsOtpSent
                        ? `Enter the verification code sent to ${getPhoneNumber(phone)} to sign in.`
                        : "Sign in securely with a one-time code sent to your mobile number."
                      : "Sign in securely with your email and password."}
            </p>
          </div>

          {forgotPasswordMode ? (
            <>
              {resetOtpSent ? (
                <>
                  <form onSubmit={handlePasswordReset}>
                    <div className="lumi-input-group">
                      <label htmlFor="lumi-reset-code">Verification code</label>
                      <input
                        id="lumi-reset-code"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        value={resetCode}
                        onChange={(event) => setResetCode(event.target.value.replace(/\D/g, ""))}
                        placeholder="6-digit code"
                        required
                      />
                    </div>
                    <div className="lumi-input-group">
                      <label htmlFor="lumi-reset-new-password">New password</label>
                      <div className="lumi-password-box">
                        <input
                          id="lumi-reset-new-password"
                          type={showPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(event) => setNewPassword(event.target.value)}
                          minLength={8}
                          autoComplete="new-password"
                          required
                        />
                        <button type="button" className="lumi-show-password" onClick={() => setShowPassword((value) => !value)}>
                          {showPassword ? "HIDE" : "SHOW"}
                        </button>
                      </div>
                    </div>
                    <div className="lumi-input-group">
                      <label htmlFor="lumi-reset-confirm-password">Confirm new password</label>
                      <input
                        id="lumi-reset-confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        minLength={8}
                        autoComplete="new-password"
                        required
                      />
                    </div>
                    {authError && <p className="lumi-auth-error" role="alert">{authError}</p>}
                    <button type="submit" className="lumi-submit-btn" disabled={isResettingPassword || resetCode.length !== 6}>
                      {isResettingPassword ? "Updating password..." : "Update password"} <span>↗</span>
                    </button>
                  </form>
                  <div className="lumi-otp-actions">
                    <button
                      type="button"
                      className="lumi-text-link"
                      onClick={() => {
                        setResetOtpSent(false);
                        setResetCode("");
                        setAuthError("");
                      }}
                    >
                      Change email address
                    </button>
                    <button
                      type="button"
                      className="lumi-text-link"
                      onClick={requestPasswordReset}
                      disabled={isResettingPassword || resendSeconds > 0}
                    >
                      {isResettingPassword ? "Sending..." : resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Resend code"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <form onSubmit={requestPasswordReset}>
                    <div className="lumi-input-group">
                      <label htmlFor="lumi-reset-email">Email Address</label>
                      <input id="lumi-reset-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" autoComplete="email" required />
                    </div>
                    {authError && <p className="lumi-auth-error" role="alert">{authError}</p>}
                    <button type="submit" className="lumi-submit-btn" disabled={isResettingPassword}>
                      {isResettingPassword ? "Sending code..." : "Send reset code"} <span>↗</span>
                    </button>
                  </form>
                </>
              )}
              <button
                type="button"
                className="lumi-text-link lumi-back-to-signin"
                onClick={() => {
                  setForgotPasswordMode(false);
                  setResetOtpSent(false);
                  setAuthError("");
                }}
              >
                Back to sign in
              </button>
            </>
          ) : (
            <>
              <div className="lumi-tabs">
                <button
                  type="button"
                  className={`lumi-tab ${!signupMode ? "active" : ""}`}
                  onClick={() => {
                    setSignupMode(false);
                    setForgotPasswordMode(false);
                    setSmsOtpSent(false);
                    setSmsCode("");
                    setSignupConfirmPassword("");
                    setAuthError("");
                  }}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  className={`lumi-tab ${signupMode ? "active" : ""}`}
                  onClick={() => {
                    setSignupMode(true);
                    setForgotPasswordMode(false);
                    setSmsOtpSent(false);
                    setSmsCode("");
                    setSignupConfirmPassword("");
                    setAuthError("");
                  }}
                >
                  Sign Up
                </button>
              </div>

              <div className="lumi-tabs lumi-channel-tabs" aria-label="Choose email or mobile">
                <button
                  type="button"
                  className={`lumi-tab ${otpChannel === "email" ? "active" : ""}`}
                  aria-pressed={otpChannel === "email"}
                  onClick={() => {
                    setOtpChannel("email");
                    setSmsOtpSent(false);
                    setSmsCode("");
                    setAuthError("");
                  }}
                >
                  Email
                </button>
                <button
                  type="button"
                  className={`lumi-tab ${otpChannel === "sms" ? "active" : ""}`}
                  aria-pressed={otpChannel === "sms"}
                  onClick={() => {
                    setOtpChannel("sms");
                    setSmsOtpSent(false);
                    setSmsCode("");
                    setAuthError("");
                  }}
                >
                  Mobile
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                {signupMode && <div className="lumi-input-group">
                  <label htmlFor="lumi-name">Full Name</label>
                  <input id="lumi-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" required />
                </div>}
                {otpChannel === "email" ? (
                  <div className="lumi-input-group">
                    <label htmlFor="lumi-email">Email Address</label>
                    <input id="lumi-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" autoComplete="email" required />
                  </div>
                ) : smsOtpSent ? (
                  <div className="lumi-input-group">
                    <label htmlFor="lumi-sms-code">SMS verification code</label>
                    <input
                      id="lumi-sms-code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      value={smsCode}
                      onChange={(event) => setSmsCode(event.target.value.replace(/\D/g, ""))}
                      placeholder="6-digit code"
                      required
                    />
                  </div>
                ) : (
                  <div className="lumi-input-group">
                    <label htmlFor="lumi-phone">Mobile phone number</label>
                    <div className="lumi-phone-input">
                      <span>+91</span>
                      <input
                        id="lumi-phone"
                        type="tel"
                        inputMode="numeric"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))}
                        placeholder="9876543210"
                        pattern="[0-9]{10}"
                        maxLength={10}
                        autoComplete="tel"
                        aria-describedby="lumi-phone-help"
                        required
                      />
                    </div>
                    <p className="lumi-input-help" id="lumi-phone-help">Enter 10 digits. India country code +91 is added automatically.</p>
                  </div>
                )}
                {otpChannel === "email" && (
                  <>
                    <div className="lumi-input-group">
                      <label htmlFor="lumi-password">{signupMode ? "Create password" : "Password"}</label>
                      <div className="lumi-password-box">
                        <input
                          id="lumi-password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          placeholder={signupMode ? "At least 8 characters" : "Enter your password"}
                          minLength={signupMode ? 8 : undefined}
                          autoComplete={signupMode ? "new-password" : "current-password"}
                          required
                        />
                        <button type="button" className="lumi-show-password" onClick={() => setShowPassword((value) => !value)}>
                          {showPassword ? "HIDE" : "SHOW"}
                        </button>
                      </div>
                    </div>
                    {signupMode && (
                      <div className="lumi-input-group">
                        <label htmlFor="lumi-signup-confirm-password">Confirm password</label>
                        <input
                          id="lumi-signup-confirm-password"
                          type="password"
                          value={signupConfirmPassword}
                          onChange={(event) => setSignupConfirmPassword(event.target.value)}
                          placeholder="Re-enter your password"
                          minLength={8}
                          autoComplete="new-password"
                          required
                        />
                      </div>
                    )}
                  </>
                )}
                {!signupMode && otpChannel === "email" && <div className="lumi-form-options">
                  <label className="lumi-remember"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember me</label>
                  <button
                    type="button"
                    className="lumi-text-link"
                    onClick={() => {
                      setForgotPasswordMode(true);
                      setResetOtpSent(false);
                      setResetCode("");
                      setNewPassword("");
                      setConfirmPassword("");
                      setAuthError("");
                    }}
                  >
                    Forgot password?
                  </button>
                </div>}
                {authError && <p className="lumi-auth-error" role="alert">{authError}</p>}
                <button
                  type="submit"
                  className="lumi-submit-btn"
                  disabled={isSubmittingAuth || (otpChannel === "sms" && smsOtpSent && smsCode.length !== 6)}
                >
                  {isSubmittingAuth
                    ? otpChannel === "sms"
                      ? smsOtpSent ? "Verifying code..." : "Sending code..."
                      : signupMode ? "Creating account..." : "Signing in..."
                    : otpChannel === "sms"
                      ? smsOtpSent ? "Verify code & continue" : "Send verification code"
                      : signupMode ? "Create Account" : "Sign In"}
                  {" "}<span>↗</span>
                </button>
              </form>
              {otpChannel === "sms" && smsOtpSent && (
                <div className="lumi-otp-actions">
                  <button
                    type="button"
                    className="lumi-text-link"
                    onClick={() => {
                      setSmsOtpSent(false);
                      setSmsCode("");
                      setResendSeconds(0);
                      setAuthError("");
                    }}
                  >
                    Change phone number
                  </button>
                  <button
                    type="button"
                    className="lumi-text-link"
                    onClick={sendPhoneOtp}
                    disabled={isSubmittingAuth || resendSeconds > 0}
                  >
                    {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Resend code"}
                  </button>
                </div>
              )}
            </>
          )}
          <p className="lumi-footer-text">By continuing, you agree to our <a href="#terms" onClick={(e) => e.preventDefault()}>Terms</a> &amp; <a href="#privacy" onClick={(e) => e.preventDefault()}>Privacy Policy</a>.</p>
        </section>
        <div className="lumi-bottom-text"><span>YOUR MONEY IN A CLEAR LIGHT</span><span>© 2026 FINSIGHT</span></div>
      </main>
      {toast && <div className="lumi-toast" role="status">{toast}</div>}
    </div>
  );
}
