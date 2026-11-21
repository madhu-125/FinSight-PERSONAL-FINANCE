import React, { useEffect, useRef, useState } from "react";
import "./Login.css";

const API_BASE_URL = process.env.REACT_APP_API_URL || "";

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
  const demoAuthEnabled = process.env.REACT_APP_DEMO_AUTH === "true" && process.env.NODE_ENV !== "production";
  const [signupMode, setSignupMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [toast, setToast] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [otpChannel, setOtpChannel] = useState("email");
  const [phone, setPhone] = useState("");
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [authError, setAuthError] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
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
      particles = Array.from({ length: 60 }, () => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 0.4 + 0.1,
        opacity: Math.random() * 0.5 + 0.1,
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
        ctx.fillStyle = `rgba(190, 255, 215, ${particle.opacity})`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = "rgba(130,255,190,0.4)";
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

  const requestOtp = async () => {
    setIsSendingOtp(true);
    setAuthError("");
    try {
      const destination = otpChannel === "email" ? email : phone;
      const recipient = otpChannel === "email" ? { email } : { phone };
      const response = await fetch(`${API_BASE_URL}/api/auth/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ channel: otpChannel, ...recipient }),
      });
      const result = await parseApiResponse(response);
      setOtpStep(true);
      setOtpCode("");
      setResendSeconds(result.resendAfterSeconds || 60);
      showToast(`Verification code sent to ${destination}.`);
    } catch (error) {
      if (error.retryAfterSeconds) setResendSeconds(error.retryAfterSeconds);
      setAuthError(error.message);
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (signupMode && !name.trim()) {
      setAuthError("Please enter your name.");
      return;
    }
    if (demoAuthEnabled && !signupMode) {
      onLogin?.({
        name: email.trim(),
        email: otpChannel === "email" ? email : "",
        phone: otpChannel === "sms" ? phone : "",
        channel: otpChannel,
        remember,
      });
      return;
    }
    await requestOtp();
  };

  const handleVerifyOtp = async (event) => {
    event.preventDefault();
    setAuthError("");
    setIsVerifyingOtp(true);
    try {
      const recipient = otpChannel === "email" ? { email } : { phone };
      const response = await fetch(`${API_BASE_URL}/api/auth/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ channel: otpChannel, ...recipient, code: otpCode }),
      });
      await parseApiResponse(response);
      onLogin?.({
        name: signupMode ? name : "Alex Morgan",
        email: otpChannel === "email" ? email : "",
        phone: otpChannel === "sms" ? phone : "",
        channel: otpChannel,
        remember,
      });
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  return (
    <div className={`lumi-login ${signupMode ? "signup-mode" : ""}`}>
      <canvas className="lumi-particles" ref={canvasRef} aria-hidden="true" />
      <main className="lumi-scene">
        <button className="lumi-back-button" type="button" onClick={onBackToLanding}>
          ← Back
        </button>
        <section className="lumi-login-card">
          <div className="lumi-card-header">
            <span className="lumi-brand-icon">✦</span>
            <p className="lumi-brand">FINSIGHT</p>
            <h1>{otpStep ? `Verify your ${otpChannel === "email" ? "email" : "phone"}` : signupMode ? "Create account" : "Welcome back"}</h1>
            <p className="lumi-subtitle">
              {otpStep
                ? `Enter the 6-digit code sent to ${otpChannel === "email" ? email : phone}.`
                : signupMode
                  ? "Start your journey with FinSight."
                  : "Step into your world of possibilities."}
            </p>
          </div>

          {!otpStep ? (
            <>
              <div className="lumi-tabs">
                <button type="button" className={`lumi-tab ${!signupMode ? "active" : ""}`} onClick={() => setSignupMode(false)}>Sign In</button>
                <button type="button" className={`lumi-tab ${signupMode ? "active" : ""}`} onClick={() => setSignupMode(true)}>Sign Up</button>
              </div>

              <div className="lumi-tabs lumi-channel-tabs" aria-label="Choose OTP delivery method">
                <button
                  type="button"
                  className={`lumi-tab ${otpChannel === "email" ? "active" : ""}`}
                  aria-pressed={otpChannel === "email"}
                  onClick={() => {
                    setOtpChannel("email");
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
                    setAuthError("");
                  }}
                >
                  SMS
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
                    <input id="lumi-email" type={demoAuthEnabled && !signupMode ? "text" : "email"} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" autoComplete="email" required />
                  </div>
                ) : (
                  <div className="lumi-input-group">
                    <label htmlFor="lumi-phone">Mobile phone number</label>
                    <input
                      id="lumi-phone"
                      type="tel"
                      inputMode="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+14155550123"
                      autoComplete="tel"
                      aria-describedby="lumi-phone-help"
                      required
                    />
                    <p className="lumi-input-help" id="lumi-phone-help">Include your country code, for example +14155550123.</p>
                  </div>
                )}
                <div className="lumi-input-group">
                  <label htmlFor="lumi-password">Password</label>
                  <div className="lumi-password-box">
                    <input id="lumi-password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" minLength={signupMode ? 6 : undefined} autoComplete={signupMode ? "new-password" : "current-password"} required />
                    <button type="button" className="lumi-show-password" onClick={() => setShowPassword((value) => !value)}>{showPassword ? "HIDE" : "SHOW"}</button>
                  </div>
                </div>
                {demoAuthEnabled && !signupMode && <p className="lumi-input-help">Demo mode: enter anything to continue without verification.</p>}
                {!signupMode && <div className="lumi-form-options">
                  <label className="lumi-remember"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember me</label>
                  <button type="button" className="lumi-text-link" onClick={() => showToast("Password reset can be connected to your backend later.")}>Forgot password?</button>
                </div>}
                {authError && <p className="lumi-auth-error" role="alert">{authError}</p>}
                <button type="submit" className="lumi-submit-btn" disabled={isSendingOtp}>
                  {isSendingOtp ? "Sending code..." : signupMode ? "Create Account" : `Continue with ${otpChannel === "email" ? "email" : "SMS"}`} <span>↗</span>
                </button>
              </form>

              <div className="lumi-divider"><span>OR CONTINUE WITH</span></div>
              <div className="lumi-social-buttons">
                <button type="button" className="lumi-social-btn" onClick={() => showToast("Google sign-in is not connected yet.")}>Google</button>
                <button type="button" className="lumi-social-btn" onClick={() => showToast("Apple sign-in is not connected yet.")}>Apple</button>
              </div>
            </>
          ) : (
            <>
              <form onSubmit={handleVerifyOtp}>
                <div className="lumi-input-group">
                  <label htmlFor="lumi-otp">Verification code</label>
                  <input
                    id="lumi-otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={otpCode}
                    onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, ""))}
                    placeholder="6-digit code"
                    required
                  />
                </div>
                {authError && <p className="lumi-auth-error" role="alert">{authError}</p>}
                <button type="submit" className="lumi-submit-btn" disabled={isVerifyingOtp || otpCode.length !== 6}>
                  {isVerifyingOtp ? "Verifying..." : "Verify and continue"} <span>↗</span>
                </button>
              </form>
              <div className="lumi-otp-actions">
                <button
                  type="button"
                  className="lumi-text-link"
                  onClick={() => {
                    setOtpStep(false);
                    setOtpCode("");
                    setAuthError("");
                  }}
                >
                  Change verification method or recipient
                </button>
                <button
                  type="button"
                  className="lumi-text-link"
                  onClick={requestOtp}
                  disabled={isSendingOtp || resendSeconds > 0}
                >
                  {isSendingOtp ? "Sending..." : resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Resend code"}
                </button>
              </div>
            </>
          )}
          <p className="lumi-footer-text">By continuing, you agree to our <a href="#terms" onClick={(e) => e.preventDefault()}>Terms</a> &amp; <a href="#privacy" onClick={(e) => e.preventDefault()}>Privacy Policy</a>.</p>
        </section>
        <div className="lumi-bottom-text"><span>YOUR MONEY, IN A CLEARER LIGHT</span><span>© 2026 FINSIGHT</span></div>
      </main>
      {toast && <div className="lumi-toast" role="status">{toast}</div>}
    </div>
  );
}