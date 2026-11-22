// React application for authenticated finance, profile, and account workflows.
import React, { useCallback, useEffect, useRef, useState } from "react";
import Login, { PullLamp } from "./Login";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  ChartNoAxesCombined,
  Target,
  Sparkles,
  Settings,
  Bell,
  UserRound,
  Search,
  Plus,
  TrendingUp,
  TrendingDown,
  Menu,
  X,
  ArrowUpRight,
  CalendarDays,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { motion } from "framer-motion";
import { jsPDF } from "jspdf";
import { API_BASE_URL } from "./apiBaseUrl";
import "./App.css";

const navigation = [
  { name: "Dashboard", icon: LayoutDashboard },
  { name: "Transactions", icon: ArrowLeftRight },
  { name: "Accounts", icon: Wallet },
  { name: "Analytics", icon: ChartNoAxesCombined },
  { name: "Budgets", icon: Target },
  { name: "AI Insights", icon: Sparkles },
  { name: "Profile", icon: UserRound },
];

const AUTH_STORAGE_KEY = "finsight-authenticated";
const HIGH_EXPENSE_RATIO = 0.8;
const LOW_CASH_FLOW_RATIO = 0.1;
const CURRENCY_FORMATTER = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
});
const ANALYTICS_COLORS = ["#9b7bff", "#38d9b2", "#ffb86b", "#5e9cff", "#ff7f9f", "#7ed6df"];

function getAnalyticsData(transactions) {
  const now = new Date();
  const monthFormatter = new Intl.DateTimeFormat("en-IN", { month: "short" });
  const monthlyMap = new Map();
  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    monthlyMap.set(monthKey, {
      month: monthKey,
      label: monthFormatter.format(date),
      income: 0,
      expenses: 0,
    });
  }

  const categoryTotals = new Map();
  let income = 0;
  let expenses = 0;
  transactions.forEach((transaction) => {
    const amount = Number(transaction.amount);
    if (!Number.isFinite(amount) || amount <= 0) return;

    const transactionMonth = transaction.transactionDate?.slice(0, 7);
    const monthlyEntry = monthlyMap.get(transactionMonth);
    if (transaction.type === "income") {
      income += amount;
      if (monthlyEntry) monthlyEntry.income += amount;
    } else if (transaction.type === "expense") {
      expenses += amount;
      if (monthlyEntry) monthlyEntry.expenses += amount;
      const category = transaction.category?.trim() || "Uncategorized";
      categoryTotals.set(category, (categoryTotals.get(category) || 0) + amount);
    }
  });

  const categories = [...categoryTotals.entries()]
    .map(([name, value], index) => ({
      name,
      value,
      color: ANALYTICS_COLORS[index % ANALYTICS_COLORS.length],
    }))
    .sort((left, right) => right.value - left.value);

  return {
    income,
    expenses,
    net: income - expenses,
    monthly: [...monthlyMap.values()],
    categories,
  };
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getBudgetPeriodRange(budget) {
  const periodType = (budget.periodType || "MONTHLY").toUpperCase();
  const start = new Date(`${budget.periodStart || `${budget.month}-01`}T00:00:00`);
  const end = new Date(start);
  if (periodType === "WEEKLY") {
    end.setDate(end.getDate() + 6);
  } else if (periodType === "BIMONTHLY") {
    end.setMonth(end.getMonth() + 2, 0);
  } else {
    end.setMonth(end.getMonth() + 1, 0);
  }
  return { periodType, start: dateKey(start), end: dateKey(end) };
}

function formatBudgetPeriod(budget) {
  const { periodType, start, end } = getBudgetPeriodRange(budget);
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  const dateFormatter = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  if (periodType === "WEEKLY") {
    return `Weekly · ${dateFormatter.format(startDate)} – ${dateFormatter.format(endDate)}`;
  }
  if (periodType === "BIMONTHLY") {
    const monthFormatter = new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" });
    return `Every 2 months · ${monthFormatter.format(startDate)} – ${monthFormatter.format(endDate)}`;
  }
  return `Monthly · ${new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(startDate)}`;
}

function getCurrentMonthSummary(transactions, budgets, now = new Date()) {
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const today = dateKey(now);
  let income = 0;
  let expenses = 0;
  const categoryTotals = new Map();

  transactions.forEach((transaction) => {
    if (transaction.transactionDate?.slice(0, 7) !== month) return;
    const amount = Number(transaction.amount);
    if (!Number.isFinite(amount) || amount <= 0) return;

    if (transaction.type === "income") {
      income += amount;
    } else if (transaction.type === "expense") {
      expenses += amount;
      const category = transaction.category?.trim() || "Uncategorized";
      const key = category.toLocaleLowerCase();
      const current = categoryTotals.get(key);
      categoryTotals.set(key, {
        name: current?.name || category,
        value: (current?.value || 0) + amount,
      });
    }
  });

  const categories = [...categoryTotals.values()].sort((left, right) => right.value - left.value);
  const currentBudgets = budgets
    .map((budget) => ({ ...budget, range: getBudgetPeriodRange(budget) }))
    .filter(({ range }) => range.start <= today && range.end >= today)
    .map((budget) => {
      const amount = Number(budget.amount);
      const category = budget.category?.trim() || "";
      const { range } = budget;
      const spending = transactions.reduce((total, transaction) => {
        const transactionDate = transaction.transactionDate;
        if (
          transaction.type !== "expense"
          || transaction.category?.trim().toLocaleLowerCase() !== category.toLocaleLowerCase()
          || transactionDate < range.start
          || transactionDate > range.end
        ) {
          return total;
        }
        return total + Number(transaction.amount || 0);
      }, 0);
      return {
        ...budget,
        amount,
        category,
        spending,
        exceeded: Number.isFinite(amount) && spending > amount,
      };
    })
    .filter((budget) => Number.isFinite(budget.amount) && budget.amount > 0);

  return {
    month,
    income,
    expenses,
    net: income - expenses,
    categories,
    budgets: currentBudgets,
    hasActivity: income > 0 || expenses > 0,
  };
}

function getFinancialAlerts(monthSummary, preferences) {
  const alerts = [];
  if (preferences.highExpenseAlerts) {
    if (monthSummary.income > 0 && monthSummary.expenses >= monthSummary.income * HIGH_EXPENSE_RATIO) {
      alerts.push({
        id: "high-expenses",
        title: "High expenses this month",
        message: `Expenses have reached ${Math.round((monthSummary.expenses / monthSummary.income) * 100)}% of your income.`,
        tone: "warning",
      });
    }
    monthSummary.budgets.filter((budget) => budget.exceeded).forEach((budget) => {
      const periodType = (budget.periodType || "MONTHLY").toUpperCase();
      const periodName = periodType === "WEEKLY"
        ? "weekly"
        : periodType === "BIMONTHLY" ? "two-month" : "monthly";
      alerts.push({
        id: `budget-${budget.id}`,
        title: `${budget.category} ${periodType === "MONTHLY" ? "" : `${periodName} `}budget exceeded`,
        message: `You've spent ${CURRENCY_FORMATTER.format(budget.spending)} of your ${periodName} limit (${CURRENCY_FORMATTER.format(budget.amount)}).`,
        tone: "warning",
      });
    });
  }

  const lowCashFlow = monthSummary.income > 0
    ? monthSummary.net <= monthSummary.income * LOW_CASH_FLOW_RATIO
    : monthSummary.expenses > 0;
  if (preferences.lowCashFlowAlerts && monthSummary.hasActivity && lowCashFlow) {
    alerts.push({
      id: "low-cash-flow",
      title: "Low net cash flow",
      message: `This month's income minus expenses is ${CURRENCY_FORMATTER.format(monthSummary.net)}.`,
      tone: "critical",
    });
  }
  return alerts;
}

function getAiInsights(monthSummary) {
  if (!monthSummary.hasActivity) {
    return [{
      title: "Start with your first transaction",
      message: "Add income and expenses to get insights about this month's cash flow, spending categories, and budgets.",
      tone: "neutral",
    }];
  }

  const insights = [];
  if (monthSummary.net < 0) {
    insights.push({
      title: "Spending is above income",
      message: `Expenses are ${CURRENCY_FORMATTER.format(Math.abs(monthSummary.net))} higher than income this month. Review flexible spending and your category budgets.`,
      tone: "critical",
    });
  } else if (monthSummary.income > 0) {
    const savingsRate = Math.round((monthSummary.net / monthSummary.income) * 100);
    insights.push({
      title: savingsRate <= LOW_CASH_FLOW_RATIO * 100 ? "Cash-flow cushion is tight" : "You're keeping money in reserve",
      message: `${CURRENCY_FORMATTER.format(monthSummary.net)} remains after this month's recorded expenses (${savingsRate}% of income).`,
      tone: savingsRate <= LOW_CASH_FLOW_RATIO * 100 ? "warning" : "positive",
    });
  } else {
    insights.push({
      title: "No income recorded this month",
      message: `You've recorded ${CURRENCY_FORMATTER.format(monthSummary.expenses)} in expenses. Add any income entries to see your full cash-flow picture.`,
      tone: "warning",
    });
  }

  const topCategory = monthSummary.categories[0];
  if (topCategory) {
    insights.push({
      title: `${topCategory.name} is your top spending category`,
      message: `You've recorded ${CURRENCY_FORMATTER.format(topCategory.value)} in ${topCategory.name} this month.`,
      tone: "neutral",
    });
  }

  if (monthSummary.budgets.length > 0) {
    const exceeded = monthSummary.budgets.filter((budget) => budget.exceeded);
    insights.push(exceeded.length > 0
      ? {
        title: `${exceeded.length} budget${exceeded.length === 1 ? "" : "s"} over limit`,
        message: exceeded.map((budget) => budget.category).join(", ") + (exceeded.length === 1 ? " is" : " are") + " above their budget limits. Review these categories before adding more discretionary spending.",
        tone: "warning",
      }
      : {
        title: "Your budgets are on track",
        message: "Recorded spending is within each of your active category limits.",
        tone: "positive",
      });
  }
  return insights;
}

function AiInsightsView({ monthSummary, onViewTransactions }) {
  const insights = getAiInsights(monthSummary);
  return (
    <section className="insights-page">
      <div className="transactions-page-header">
        <div>
          <h2>AI Insights</h2>
          <p>Personalized observations from your saved financial activity this month.</p>
        </div>
      </div>
      <div className="analytics-summary-grid">
        <article className="analytics-summary-card">
          <span className="analytics-summary-icon analytics-income-icon"><TrendingUp size={19} /></span>
          <span className="analytics-summary-label">Income this month</span>
          <strong>{CURRENCY_FORMATTER.format(monthSummary.income)}</strong>
        </article>
        <article className="analytics-summary-card">
          <span className="analytics-summary-icon analytics-expense-icon"><TrendingDown size={19} /></span>
          <span className="analytics-summary-label">Expenses this month</span>
          <strong>{CURRENCY_FORMATTER.format(monthSummary.expenses)}</strong>
        </article>
        <article className="analytics-summary-card">
          <span className="analytics-summary-icon analytics-net-icon"><Wallet size={19} /></span>
          <span className="analytics-summary-label">Net cash flow</span>
          <strong className={monthSummary.net < 0 ? "analytics-negative" : ""}>
            {CURRENCY_FORMATTER.format(monthSummary.net)}
          </strong>
        </article>
      </div>
      <div className="insight-list">
        {insights.map((insight) => (
          <article className={`insight-card insight-${insight.tone}`} key={insight.title}>
            <span className="insight-card-icon"><Sparkles size={19} /></span>
            <div>
              <h3>{insight.title}</h3>
              <p>{insight.message}</p>
            </div>
          </article>
        ))}
      </div>
      <p className="insights-disclaimer">Insights are generated from your saved transactions and budgets; they are guidance, not financial advice.</p>
      <button className="add-button" type="button" onClick={onViewTransactions}>
        Review transactions <ArrowUpRight size={17} />
      </button>
    </section>
  );
}

function ProfileView({
  userInfo,
  greetingName,
  preferences,
  profilePhoto,
  profilePhotoZoom,
  onPreferenceChange,
  onProfileUpdated,
  onProfilePhotoChange,
  onProfilePhotoZoomChange,
  onLogout,
}) {
  const [displayName, setDisplayName] = useState(userInfo.name || "");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [address, setAddress] = useState("");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSavingName, setIsSavingName] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [cameraStream, setCameraStream] = useState(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isOpeningCamera, setIsOpeningCamera] = useState(false);
  const initialDisplayName = useRef(userInfo.name || "");
  const isMountedRef = useRef(true);
  const photoInputRef = useRef(null);
  const profileNameInputRef = useRef(null);
  const cameraVideoRef = useRef(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!cameraStream) return undefined;
    return () => cameraStream.getTracks().forEach((track) => track.stop());
  }, [cameraStream]);

  useEffect(() => {
    if (!cameraStream || !cameraVideoRef.current) return undefined;
    const video = cameraVideoRef.current;
    video.srcObject = cameraStream;
    return () => {
      video.srcObject = null;
    };
  }, [cameraStream]);

  useEffect(() => {
    let active = true;
    getApiJson("/api/auth/profile")
      .then((profile) => {
        if (!active) return;
        setDisplayName(profile.displayName || initialDisplayName.current);
        setAge(profile.age == null ? "" : String(profile.age));
        setGender(profile.gender || "");
        setMobileNumber(profile.mobileNumber || "");
        setAddress(profile.address || "");
        onProfileUpdated(profile);
      })
      .catch((error) => {
        if (active) setProfileError(error.message);
      })
      .finally(() => {
        if (active) setIsLoadingProfile(false);
      });
    return () => {
      active = false;
    };
  }, [onProfileUpdated, userInfo.email, userInfo.phone]);

  const resetProfileForm = () => {
    setDisplayName(userInfo.name || "");
    setAge(userInfo.age == null ? "" : String(userInfo.age));
    setGender(userInfo.gender || "");
    setMobileNumber(userInfo.mobileNumber || "");
    setAddress(userInfo.address || "");
  };

  const handleProfileEditClick = () => {
    if (isEditingProfile) {
      profileNameInputRef.current?.focus();
      return;
    }
    resetProfileForm();
    setIsEditingProfile(true);
    setProfileError("");
    setProfileMessage("");
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setProfileError("");
    setProfileMessage("");
    setIsSavingName(true);
    try {
      const profile = await putApiJson("/api/auth/profile", {
        displayName: displayName.trim(),
        age: age ? Number(age) : null,
        gender: gender || null,
        mobileNumber: mobileNumber.trim() || null,
        address: address.trim() || null,
      });
      setDisplayName(profile.displayName || "");
      setAge(profile.age == null ? "" : String(profile.age));
      setGender(profile.gender || "");
      setMobileNumber(profile.mobileNumber || "");
      setAddress(profile.address || "");
      onProfileUpdated(profile);
      setIsEditingProfile(false);
      setProfileMessage("Your profile details have been updated.");
    } catch (error) {
      setProfileError(error.message);
    } finally {
      setIsSavingName(false);
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setPasswordError("");
    setPasswordMessage("");
    if (newPassword.length < 8) {
      setPasswordError("Use at least 8 characters for your password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("The new passwords do not match.");
      return;
    }

    setIsSavingPassword(true);
    try {
      await putApiJson("/api/auth/password", {
        newPassword,
      });
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("Your password has been updated.");
    } catch (error) {
      setPasswordError(error.message);
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handlePhotoSelection = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPhotoError("");
    setCameraError("");
    if (!file.type.startsWith("image/")) {
      setPhotoError("Choose an image file.");
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => setPhotoError("The selected image could not be read.");
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setPhotoError("The selected image could not be read.");
        return;
      }
      const image = new Image();
      image.onerror = () => setPhotoError("The selected image could not be opened.");
      image.onload = () => {
        const scale = Math.min(1, 512 / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          setPhotoError("Your browser could not process this image.");
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        if (!onProfilePhotoChange(canvas.toDataURL("image/jpeg", 0.85))) {
          setPhotoError("The image could not be saved in this browser.");
        }
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const handleOpenCamera = async () => {
    setCameraError("");
    setIsCameraReady(false);
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
      setCameraError("Live camera access is not available in this browser. You can upload a photo instead.");
      return;
    }
    setIsOpeningCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      if (!isMountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      setCameraStream(stream);
      setIsCameraOpen(true);
    } catch (error) {
      if (!isMountedRef.current) return;
      if (error.name === "NotAllowedError" || error.name === "SecurityError") {
        setCameraError("Camera permission was denied. Allow camera access in your browser and try again.");
      } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
        setCameraError("No camera was found. You can upload a photo instead.");
      } else {
        setCameraError(error.message || "The camera could not be opened. You can upload a photo instead.");
      }
    } finally {
      if (isMountedRef.current) setIsOpeningCamera(false);
    }
  };

  const handleCameraCapture = () => {
    const video = cameraVideoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setCameraError("Wait for the camera preview before taking a selfie.");
      return;
    }
    const scale = Math.min(1, 512 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError("Your browser could not process this selfie.");
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    try {
      if (!onProfilePhotoChange(canvas.toDataURL("image/jpeg", 0.85))) {
        setCameraError("The selfie could not be saved in this browser.");
        return;
      }
      setIsCameraOpen(false);
      setCameraStream(null);
      setIsCameraReady(false);
      setPhotoError("");
    } catch (error) {
      setCameraError(error.message || "The selfie could not be saved in this browser.");
    }
  };

  const handleCloseCamera = () => {
    setIsCameraOpen(false);
    setCameraStream(null);
    setIsCameraReady(false);
    setCameraError("");
  };

  return (
    <>
    <section className="profile-page">
      <div className="transactions-page-header">
        <div>
          <h2>Profile &amp; settings</h2>
          <p>Update your details, sign-in security, and personal preferences.</p>
        </div>
        <button className="profile-signout-button" type="button" onClick={onLogout}>Sign out</button>
      </div>
      <div className="profile-grid">
        <section className="panel profile-card" aria-labelledby="profile-details-title">
          <div className="profile-card-heading">
            <div className="avatar profile-photo">
              {profilePhoto
                ? <img src={profilePhoto} alt="" style={{ transform: `scale(${profilePhotoZoom})` }} />
                : greetingName === "there" ? "U" : greetingName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 id="profile-details-title">Account details</h3>
              <p>Change your profile picture or display name.</p>
            </div>
          </div>
          <div className="profile-photo-actions">
            <input
              ref={photoInputRef}
              className="profile-photo-input"
              type="file"
              accept="image/*"
              aria-label="Upload profile picture"
              onChange={handlePhotoSelection}
            />
            <button className="profile-secondary-button" type="button" onClick={() => photoInputRef.current?.click()}>
              Upload a photo
            </button>
            <button className="profile-secondary-button" type="button" onClick={handleOpenCamera} disabled={isOpeningCamera}>
              {isOpeningCamera ? "Opening camera..." : "Take a selfie"}
            </button>
            {profilePhoto && (
              <button
                className="profile-secondary-button"
                type="button"
                onClick={() => {
                  onProfilePhotoChange("");
                  onProfilePhotoZoomChange(1);
                }}
              >
                Remove picture
              </button>
            )}
          </div>
          {profilePhoto && (
            <label className="profile-photo-adjust" htmlFor="profile-photo-zoom">
              Adjust picture framing
              <input
                id="profile-photo-zoom"
                type="range"
                min="1"
                max="2"
                step="0.05"
                value={profilePhotoZoom}
                onChange={(event) => onProfilePhotoZoomChange(Number(event.target.value))}
              />
            </label>
          )}
          <p className="profile-settings-note">Upload a photo or take a selfie. Images are resized and saved in this browser for this account.</p>
          {photoError && <p className="profile-form-error" role="alert">{photoError}</p>}
          {cameraError && !isCameraOpen && <p className="profile-form-error" role="alert">{cameraError}</p>}
          {isEditingProfile ? (
            <form id="profile-edit-form" className="profile-edit-form" onSubmit={handleProfileSubmit}>
              <label className="transaction-field" htmlFor="profile-display-name">
                Name
                <input
                  ref={profileNameInputRef}
                  id="profile-display-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  maxLength={120}
                  required
                />
              </label>
              <label className="transaction-field" htmlFor="profile-age">
                Age
                <input
                  id="profile-age"
                  type="number"
                  min="1"
                  max="120"
                  value={age}
                  onChange={(event) => setAge(event.target.value)}
                />
              </label>
              <label className="transaction-field" htmlFor="profile-gender">
                Gender
                <select id="profile-gender" value={gender} onChange={(event) => setGender(event.target.value)}>
                  <option value="">Select</option>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Non-binary">Non-binary</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </label>
              <label className="transaction-field" htmlFor="profile-mobile-number">
                Mobile number
                <input
                  id="profile-mobile-number"
                  type="tel"
                  maxLength={30}
                  value={mobileNumber}
                  onChange={(event) => setMobileNumber(event.target.value)}
                  autoComplete="tel"
                />
              </label>
              <label className="transaction-field" htmlFor="profile-address">
                Address
                <textarea
                  id="profile-address"
                  rows="3"
                  maxLength={500}
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  autoComplete="street-address"
                />
              </label>
              {profileError && <p className="profile-form-error" role="alert">{profileError}</p>}
            </form>
          ) : (
            <>
              {profileError && <p className="profile-form-error" role="alert">{profileError}</p>}
              <dl className="profile-details">
                <div><dt>Name</dt><dd>{displayName || "Not provided"}</dd></div>
                <div><dt>Age</dt><dd>{age || "Not provided"}</dd></div>
                <div><dt>Gender</dt><dd>{gender || "Not provided"}</dd></div>
                <div><dt>Mobile number</dt><dd>{mobileNumber || "Not provided"}</dd></div>
                <div><dt>Address</dt><dd>{address || "Not provided"}</dd></div>
                <div><dt>Email</dt><dd>{userInfo.email || "Not provided"}</dd></div>
                <div><dt>Verified sign-in phone</dt><dd>{userInfo.phone || "Not provided"}</dd></div>
              </dl>
              <p className="profile-settings-note">The profile mobile number is separate from your verified sign-in phone.</p>
            </>
          )}
          <div className="profile-edit-actions">
            <button
              className="profile-secondary-button"
              type="button"
              onClick={handleProfileEditClick}
              disabled={isLoadingProfile}
              aria-pressed={isEditingProfile}
            >
              Edit details
            </button>
            <button className="add-button" type="submit" form="profile-edit-form" disabled={!isEditingProfile || isSavingName}>
              {isSavingName ? "Submitting..." : "Submit"}
            </button>
            {isEditingProfile && (
              <button
                className="profile-secondary-button"
                type="button"
                onClick={() => {
                  resetProfileForm();
                  setIsEditingProfile(false);
                  setProfileError("");
                }}
                disabled={isSavingName}
              >
                Cancel
              </button>
            )}
          </div>
          {profileMessage && <p className="profile-form-message" role="status">{profileMessage}</p>}
        </section>
        <div className="profile-settings-column">
          <section className="panel profile-card" aria-labelledby="profile-security-title">
            <div className="profile-card-heading">
              <div className="settings-card-icon"><Settings size={19} /></div>
              <div>
                <h3 id="profile-security-title">Password</h3>
                <p>Create or update your password while signed in.</p>
              </div>
            </div>
            <form className="profile-password-form" onSubmit={handlePasswordSubmit}>
              <label className="transaction-field" htmlFor="profile-new-password">
                New password
                <input
                  id="profile-new-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                />
              </label>
              <label className="transaction-field" htmlFor="profile-confirm-password">
                Confirm new password
                <input
                  id="profile-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                />
              </label>
              {passwordError && <p className="profile-form-error" role="alert">{passwordError}</p>}
              {passwordMessage && <p className="profile-form-message" role="status">{passwordMessage}</p>}
              <button className="add-button" type="submit" disabled={isSavingPassword}>
                {isSavingPassword ? "Saving..." : "Save password"}
              </button>
            </form>
          </section>
          <section className="panel profile-card" aria-labelledby="profile-settings-title">
            <div className="profile-card-heading">
              <div className="settings-card-icon"><Bell size={19} /></div>
              <div>
                <h3 id="profile-settings-title">Notification settings</h3>
                <p>Choose which financial alerts appear in the bell menu.</p>
              </div>
            </div>
            <label className="profile-setting">
              <span className="profile-setting-copy">
                <strong>High expense alerts</strong>
                <small>Alert when expenses reach 80% of income or exceed a category budget.</small>
              </span>
              <input
                type="checkbox"
                aria-label="High expense alerts"
                checked={preferences.highExpenseAlerts}
                onChange={(event) => onPreferenceChange("highExpenseAlerts", event.target.checked)}
              />
            </label>
            <label className="profile-setting">
              <span className="profile-setting-copy">
                <strong>Low cash-flow alerts</strong>
                <small>Alert when net cash flow is 10% or less of income, or expenses are recorded without income.</small>
              </span>
              <input
                type="checkbox"
                aria-label="Low cash-flow alerts"
                checked={preferences.lowCashFlowAlerts}
                onChange={(event) => onPreferenceChange("lowCashFlowAlerts", event.target.checked)}
              />
            </label>
            <label className="profile-setting">
              <span className="profile-setting-copy">
                <strong>Notification sounds</strong>
                <small>Play a short sound when new financial alerts arrive.</small>
              </span>
              <input
                type="checkbox"
                aria-label="Notification sounds"
                checked={preferences.notificationSound}
                onChange={(event) => onPreferenceChange("notificationSound", event.target.checked)}
              />
            </label>
            <p className="profile-settings-note">Preferences are saved in this browser for this signed-in account.</p>
          </section>
        </div>
      </div>
    </section>
    {isCameraOpen && (
      <div className="camera-modal-backdrop">
        <section className="camera-modal panel" role="dialog" aria-modal="true" aria-labelledby="camera-modal-title">
          <div className="transaction-modal-header">
            <div>
              <h2 id="camera-modal-title">Take a selfie</h2>
              <p>Position yourself in the frame, then capture your photo.</p>
            </div>
            <button className="transaction-modal-close" type="button" aria-label="Close camera" onClick={handleCloseCamera}>
              <X size={19} />
            </button>
          </div>
          <video
            ref={cameraVideoRef}
            className="camera-preview"
            aria-label="Selfie camera preview"
            autoPlay
            muted
            playsInline
            onCanPlay={() => setIsCameraReady(true)}
          />
          {cameraError && <p className="profile-form-error" role="alert">{cameraError}</p>}
          <div className="transaction-form-actions">
            <button className="profile-secondary-button" type="button" onClick={handleCloseCamera}>Cancel</button>
            <button className="add-button" type="button" onClick={handleCameraCapture} disabled={!isCameraReady}>
              Capture selfie
            </button>
          </div>
        </section>
      </div>
    )}
    </>
  );
}

async function parseApiResponse(response) {
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("The authentication server returned an invalid response.");
  }
  if (!response.ok) throw new Error(result.error || "The request could not be completed.");
  return result;
}

async function getApiJson(path) {
  const response = await fetch(`${API_BASE_URL}${path}`, { credentials: "include" });
  return parseApiResponse(response);
}

async function postApiJson(path, payload) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return parseApiResponse(response);
}

async function putApiJson(path, payload) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return parseApiResponse(response);
}

function getGreetingName(user) {
  const rawName = user.name && !user.name.includes("@")
    ? user.name
    : user.email?.split("@")[0] || user.phone || "";
  const name = rawName
    .replace(/[._-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return name || "there";
}

function findPageForQuery(query) {
  const normalized = query.trim().toLocaleLowerCase().replace(/[\s_-]+/g, " ");
  if (!normalized) return "";
  const pages = [
    { name: "Dashboard", aliases: ["home", "overview"] },
    { name: "Transactions", aliases: ["transaction", "activity", "history"] },
    { name: "Accounts", aliases: ["account", "wallet", "wallets"] },
    { name: "Analytics", aliases: ["analysis", "report", "reports", "cash flow", "cashflow"] },
    { name: "Budgets", aliases: ["budget", "spending plan"] },
    { name: "AI Insights", aliases: ["ai", "insight", "insights", "financial insights"] },
    { name: "Profile", aliases: ["user", "settings", "account settings"] },
  ];
  const exactMatch = pages.find((page) => (
    [page.name.toLocaleLowerCase(), ...page.aliases].includes(normalized)
  ));
  if (exactMatch) return exactMatch.name;
  const partialMatch = pages.find((page) => (
    [page.name.toLocaleLowerCase(), ...page.aliases].some((alias) => alias.startsWith(normalized))
  ));
  return partialMatch?.name || "";
}

function LandingPage({ onLogin }) {
  const [lampOn, setLampOn] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const loginTimer = useRef(null);

  useEffect(() => () => window.clearTimeout(loginTimer.current), []);

  const handleLampPull = () => {
    if (isPulling) return;
    setIsPulling(true);
    setLampOn(true);
    loginTimer.current = window.setTimeout(onLogin, 500);
  };

  return (
    <div className={`landing-page ${isPulling ? "is-transitioning" : ""}`}>
      <header className="landing-header">
        <a className="landing-brand" href="#home" aria-label="FinSight home">
          <span className="landing-brand-icon"><Wallet size={21} /></span>
          <span>Fin<span className="landing-brand-accent">Sight</span></span>
        </a>
        <nav className="landing-nav" aria-label="Main navigation">
          <a href="#features">Features</a>
          <a href="#preview">Your money, clearly</a>
        </nav>
        <span className="landing-header-hint">PULL THE LAMP THREAD TO BEGIN</span>
      </header>

      <main>
        <section className="landing-hero" id="home">
          <div className="landing-hero-copy">
            <div className="landing-eyebrow"><span /> YOUR MONEY, IN A BETTER LIGHT</div>
            <h1>Make every money move <span>with confidence.</span></h1>
            <p className="landing-lede">
              One calm, clear view of your finances. Track spending, build better habits,
              and make your next goal feel within reach. Pull the lamp thread to sign in.
            </p>
            <div className="landing-social-proof">
              <div className="landing-proof-avatars" aria-hidden="true">
                <span>A</span><span>M</span><span>R</span>
              </div>
              <p><strong>A smarter way to see your money</strong><br />Simple tools. Thoughtful insights.</p>
            </div>
          </div>

          <div className="landing-preview-wrap" id="preview">
            <div className="landing-orbit landing-orbit-one" />
            <div className="landing-orbit landing-orbit-two" />
            <PullLamp
              className={`landing-lamp ${isPulling ? "is-pulled" : ""}`}
              lampOn={lampOn}
              onPull={handleLampPull}
              ariaLabel="Pull the lamp thread to open FinSight login"
              caption="PULL THE LAMP THREAD TO SIGN IN / SIGN OUT"
            />
            <span className="landing-sparkle landing-sparkle-one">✦</span>
            <span className="landing-sparkle landing-sparkle-two">✧</span>
          </div>
        </section>

        <section className="landing-features" id="features">
          <div className="landing-section-heading">
            <span>MADE FOR YOUR EVERYDAY</span>
            <h2>Feel good about where your money goes.</h2>
          </div>
          <div className="landing-feature-grid">
            <article className="landing-feature">
              <span className="landing-feature-icon feature-purple"><ChartNoAxesCombined size={21} /></span>
              <h3>See the whole picture</h3>
              <p>Bring your balance, income, and spending together in one easy-to-follow view.</p>
            </article>
            <article className="landing-feature">
              <span className="landing-feature-icon feature-green"><Wallet size={21} /></span>
              <h3>Make progress feel simple</h3>
              <p>Keep your goals close and see how everyday choices move you forward.</p>
            </article>
            <article className="landing-feature">
              <span className="landing-feature-icon feature-orange"><Sparkles size={21} /></span>
              <h3>Find your next step</h3>
              <p>Get thoughtful insights that help you understand your habits and plan ahead.</p>
            </article>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <a className="landing-brand" href="#home"><span className="landing-brand-icon"><Wallet size={18} /></span><span>Fin<span className="landing-brand-accent">Sight</span></span></a>
        <span>Smart money, smarter future.</span>
      </footer>
    </div>
  );
}

function LoadingPage({ onBackToLogin }) {
  return (
    <main className="loading-page" role="status" aria-live="polite">
      <div className="loading-content">
        <div className="loading-brand-icon"><Wallet size={25} /></div>
        <p className="loading-eyebrow">FINSIGHT</p>
        <h1>Preparing your dashboard</h1>
        <p className="loading-description">Getting your finances ready...</p>
        <div className="loading-progress"><span /></div>
        <span className="loading-status">SECURELY LOADING YOUR DASHBOARD</span>
        <button className="loading-back-button" type="button" onClick={onBackToLogin}>
          Back to Login
        </button>
      </div>
    </main>
  );
}

function SessionErrorPage({ message, onRetry, onReturnToLanding }) {
  return (
    <main className="loading-page">
      <div className="loading-content">
        <p className="loading-eyebrow">FINSIGHT</p>
        <h1>Could not restore your session</h1>
        <p className="session-error-message" role="alert">{message}</p>
        <div className="session-error-actions">
          <button className="loading-back-button" type="button" onClick={onRetry}>Try again</button>
          <button className="loading-back-button" type="button" onClick={onReturnToLanding}>Return to landing</button>
        </div>
      </div>
    </main>
  );
}

function TransactionList({ transactions }) {
  if (transactions.length === 0) {
    return <p className="transaction-empty">No transactions yet.</p>;
  }

  const dateFormatter = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return transactions.map((transaction) => (
    <div className="transaction-row" key={transaction.id}>
      <div className={`transaction-icon ${transaction.type === "income" ? "green" : "purple"}`}>
        <Wallet size={19} />
      </div>
      <div className="transaction-details">
        <strong>{transaction.description}</strong>
        <span>{transaction.category}</span>
      </div>
      <span className="transaction-date">
        {dateFormatter.format(new Date(`${transaction.transactionDate}T00:00:00`))}
      </span>
      <strong className={`transaction-amount ${transaction.type}`}>
        {transaction.type === "expense" ? "−" : "+"}
        {CURRENCY_FORMATTER.format(Number(transaction.amount))}
      </strong>
    </div>
  ));
}

function TransactionForm({ onClose, onCreated }) {
  const now = new Date();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("expense");
  const [category, setCategory] = useState("");
  const [transactionDate, setTransactionDate] = useState([
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-"));
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSaving(true);
    try {
      const transaction = await postApiJson("/api/transactions", {
        description,
        amount: Number(amount),
        type,
        category,
        transactionDate,
      });
      onCreated(transaction);
      onClose();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="transaction-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) onClose();
      }}
    >
      <section
        className="transaction-modal panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-modal-title"
      >
        <div className="transaction-modal-header">
          <div>
            <h2 id="transaction-modal-title">Add transaction</h2>
            <p>Save an income or expense to your account.</p>
          </div>
          <button
            className="transaction-modal-close"
            type="button"
            aria-label="Close transaction form"
            onClick={onClose}
            disabled={isSaving}
          >
            <X size={19} />
          </button>
        </div>

        <form className="transaction-form" onSubmit={handleSubmit}>
          <label className="transaction-field transaction-field-wide" htmlFor="transaction-description">
            Description
            <input
              id="transaction-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={120}
              placeholder="e.g. Groceries"
              required
            />
          </label>

          <label className="transaction-field" htmlFor="transaction-amount">
            Amount
            <input
              id="transaction-amount"
              type="number"
              min="0.01"
              max="9999999999.99"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              required
            />
          </label>

          <label className="transaction-field" htmlFor="transaction-type">
            Type
            <select id="transaction-type" value={type} onChange={(event) => setType(event.target.value)}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </label>

          <label className="transaction-field" htmlFor="transaction-category">
            Category
            <input
              id="transaction-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              maxLength={60}
              placeholder="e.g. Food"
              required
            />
          </label>

          <label className="transaction-field" htmlFor="transaction-date">
            Date
            <input
              id="transaction-date"
              type="date"
              value={transactionDate}
              onChange={(event) => setTransactionDate(event.target.value)}
              required
            />
          </label>

          {error && <p className="transaction-form-error" role="alert">{error}</p>}

          <div className="transaction-form-actions">
            <button type="button" className="transaction-cancel-button" onClick={onClose} disabled={isSaving}>
              Cancel
            </button>
            <button type="submit" className="add-button" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save transaction"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function AccountList({ accounts }) {
  if (accounts.length === 0) {
    return <p className="transaction-empty">No accounts yet.</p>;
  }

  return (
    <div className="finance-record-list">
      {accounts.map((account) => (
        <div className="finance-record-row" key={account.id}>
          <div className="transaction-icon purple"><Wallet size={19} /></div>
          <div className="transaction-details">
            <strong>{account.name}</strong>
            <span>{account.type[0].toUpperCase() + account.type.slice(1)}</span>
          </div>
          <strong className="finance-record-amount">{CURRENCY_FORMATTER.format(Number(account.balance))}</strong>
        </div>
      ))}
    </div>
  );
}

function BudgetList({ budgets }) {
  if (budgets.length === 0) {
    return <p className="transaction-empty">No budgets yet.</p>;
  }

  return (
    <div className="finance-record-list">
      {budgets.map((budget) => {
        return (
          <div className="finance-record-row" key={budget.id}>
            <div className="transaction-icon green"><Target size={19} /></div>
            <div className="transaction-details">
              <strong>{budget.category}</strong>
              <span>{formatBudgetPeriod(budget)}</span>
            </div>
            <strong className="finance-record-amount">{CURRENCY_FORMATTER.format(Number(budget.amount))}</strong>
          </div>
        );
      })}
    </div>
  );
}

function downloadBudgetPdf(budgets, periodType) {
  const entries = budgets
    .filter((budget) => (budget.periodType || "MONTHLY").toUpperCase() === periodType)
    .sort((left, right) => (
      getBudgetPeriodRange(left).start.localeCompare(getBudgetPeriodRange(right).start)
      || left.category.localeCompare(right.category)
    ));
  if (entries.length === 0) return false;

  const labels = {
    WEEKLY: "Weekly",
    MONTHLY: "Monthly",
    BIMONTHLY: "Every 2 Months",
  };
  const document = new jsPDF();
  document.setFont("helvetica", "bold");
  document.setFontSize(18);
  document.text("FinSight Budget Report", 18, 22);
  document.setFont("helvetica", "normal");
  document.setFontSize(11);
  document.text(`${labels[periodType]} budgets`, 18, 31);
  document.text(`Generated ${new Intl.DateTimeFormat("en-IN", { dateStyle: "long" }).format(new Date())}`, 18, 38);

  let y = 52;
  entries.forEach((budget) => {
    if (y > 270) {
      document.addPage();
      y = 20;
    }
    document.setFont("helvetica", "bold");
    document.text(budget.category, 18, y);
    document.setFont("helvetica", "normal");
    document.text(formatBudgetPeriod(budget).replace(/[·–]/g, "-"), 18, y + 6);
    document.text(`INR ${Number(budget.amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 192, y, { align: "right" });
    y += 16;
  });

  document.save(`finsight-${periodType.toLowerCase()}-budgets.pdf`);
  return true;
}

function getTransactionReportRange(periodType, selectedDate) {
  let startDate;
  let endDate;
  if (periodType === "MONTHLY") {
    const [year, month] = selectedDate.split("-").map(Number);
    startDate = new Date(year, month - 1, 1);
    endDate = new Date(year, month, 0);
  } else {
    startDate = new Date(`${selectedDate}T00:00:00`);
    endDate = new Date(startDate);
    if (periodType === "WEEKLY") {
      startDate.setDate(startDate.getDate() - ((startDate.getDay() + 6) % 7));
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
    }
  }
  return {
    start: dateKey(startDate),
    end: dateKey(endDate),
  };
}

function downloadTransactionPdf(transactions, periodType, selectedDate) {
  const range = getTransactionReportRange(periodType, selectedDate);
  const entries = transactions
    .filter((transaction) => transaction.transactionDate >= range.start && transaction.transactionDate <= range.end)
    .sort((left, right) => right.transactionDate.localeCompare(left.transactionDate) || right.id - left.id);
  if (entries.length === 0) return false;

  const labels = {
    DAILY: "Day-wise",
    WEEKLY: "Weekly",
    MONTHLY: "Monthly",
  };
  const dateFormatter = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const startLabel = dateFormatter.format(new Date(`${range.start}T00:00:00`));
  const endLabel = dateFormatter.format(new Date(`${range.end}T00:00:00`));
  const income = entries
    .filter((transaction) => transaction.type === "income")
    .reduce((total, transaction) => total + Number(transaction.amount), 0);
  const expenses = entries
    .filter((transaction) => transaction.type === "expense")
    .reduce((total, transaction) => total + Number(transaction.amount), 0);

  const document = new jsPDF();
  document.setFont("helvetica", "bold");
  document.setFontSize(18);
  document.text("FinSight Transaction Report", 18, 22);
  document.setFont("helvetica", "normal");
  document.setFontSize(11);
  document.text(`${labels[periodType]} transactions: ${startLabel} - ${endLabel}`, 18, 31);
  document.text(`Income: INR ${income.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 18, 42);
  document.text(`Expenses: INR ${expenses.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 18, 49);
  document.text(`Net: INR ${(income - expenses).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 18, 56);

  let y = 70;
  entries.forEach((transaction) => {
    if (y > 270) {
      document.addPage();
      y = 20;
    }
    const date = dateFormatter.format(new Date(`${transaction.transactionDate}T00:00:00`));
    const amount = Number(transaction.amount).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    document.text(date, 18, y);
    document.text(transaction.type === "income" ? "Income" : "Expense", 56, y);
    document.text(transaction.category || "Uncategorized", 88, y, { maxWidth: 42 });
    document.text(transaction.description || "", 132, y, { maxWidth: 42 });
    document.text(`INR ${amount}`, 192, y, { align: "right" });
    y += 12;
  });

  document.save(`finsight-transactions-${periodType.toLowerCase()}-${range.start}-to-${range.end}.pdf`);
  return true;
}

function AnalyticsView({ transactions, error }) {
  const analytics = getAnalyticsData(transactions);
  const hasMonthlyActivity = analytics.monthly.some((month) => month.income > 0 || month.expenses > 0);
  const hasExpenses = analytics.categories.length > 0;
  const totalCategorizedExpenses = analytics.categories.reduce((total, category) => total + category.value, 0);
  const compactCurrency = (value) => new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

  return (
    <section className="analytics-page">
      <div className="transactions-page-header">
        <div>
          <h2>Analytics overview</h2>
          <p>Trends and breakdowns from your saved transactions.</p>
        </div>
      </div>
      {error && <p className="transaction-form-error" role="alert">{error}</p>}

      <div className="analytics-summary-grid">
        <article className="analytics-summary-card">
          <span className="analytics-summary-icon analytics-income-icon"><TrendingUp size={19} /></span>
          <span className="analytics-summary-label">All-time income</span>
          <strong>{CURRENCY_FORMATTER.format(analytics.income)}</strong>
        </article>
        <article className="analytics-summary-card">
          <span className="analytics-summary-icon analytics-expense-icon"><TrendingDown size={19} /></span>
          <span className="analytics-summary-label">All-time expenses</span>
          <strong>{CURRENCY_FORMATTER.format(analytics.expenses)}</strong>
        </article>
        <article className="analytics-summary-card">
          <span className="analytics-summary-icon analytics-net-icon"><Wallet size={19} /></span>
          <span className="analytics-summary-label">Net cash flow</span>
          <strong className={analytics.net < 0 ? "analytics-negative" : ""}>
            {CURRENCY_FORMATTER.format(analytics.net)}
          </strong>
        </article>
      </div>

      <div className="analytics-charts-grid">
        <section className="panel analytics-panel">
          <div className="panel-header">
            <div>
              <h3>Monthly cash flow</h3>
              <p>Income and expenses over the last six months</p>
            </div>
          </div>
          {hasMonthlyActivity ? (
            <>
              <div className="chart-legend">
                <span><i className="legend-income" /> Income</span>
                <span><i className="legend-expense" /> Expenses</span>
              </div>
              <div className="area-chart analytics-area-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.monthly}>
                    <defs>
                      <linearGradient id="analyticsIncomeGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#9b7bff" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#9b7bff" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="analyticsExpenseGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#38d9b2" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#38d9b2" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#292d40" strokeDasharray="4 5" vertical={false} />
                    <XAxis dataKey="label" stroke="#777d94" tickLine={false} axisLine={false} />
                    <YAxis
                      stroke="#777d94"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={compactCurrency}
                      width={55}
                    />
                    <Tooltip
                      contentStyle={{ background: "#202438", border: "1px solid #363b54", borderRadius: 8 }}
                      formatter={(value, name) => [CURRENCY_FORMATTER.format(value), name === "income" ? "Income" : "Expenses"]}
                      labelFormatter={(label) => `Month: ${label}`}
                    />
                    <Area type="monotone" dataKey="income" name="income" stroke="#a78bfa" fill="url(#analyticsIncomeGradient)" strokeWidth={2} />
                    <Area type="monotone" dataKey="expenses" name="expenses" stroke="#38d9b2" fill="url(#analyticsExpenseGradient)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <p className="analytics-empty">No income or expenses in the last six months.</p>
          )}
        </section>

        <section className="panel analytics-panel">
          <div className="panel-header">
            <div>
              <h3>Spending by category</h3>
              <p>All-time expenses grouped by category</p>
            </div>
          </div>
          {hasExpenses ? (
            <>
              <div className="donut-container analytics-donut">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analytics.categories}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={56}
                      outerRadius={78}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {analytics.categories.map((category) => (
                        <Cell key={category.name} fill={category.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "#202438", border: "1px solid #363b54", borderRadius: 8 }}
                      formatter={(value) => CURRENCY_FORMATTER.format(value)}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-center">
                  <span>Total spent</span>
                  <strong>{CURRENCY_FORMATTER.format(analytics.expenses)}</strong>
                </div>
              </div>
              <div className="analytics-category-list">
                {analytics.categories.map((category) => (
                  <div className="analytics-category-row" key={category.name}>
                    <span className="analytics-category-name">
                      <i style={{ backgroundColor: category.color }} />
                      {category.name}
                    </span>
                    <span>{CURRENCY_FORMATTER.format(category.value)}</span>
                    <strong>{Math.round((category.value / totalCategorizedExpenses) * 100)}%</strong>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="analytics-empty">Add an expense to see your category breakdown.</p>
          )}
        </section>
      </div>
    </section>
  );
}

function AccountForm({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("checking");
  const [balance, setBalance] = useState("0");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSaving(true);
    try {
      const account = await postApiJson("/api/accounts", {
        name,
        type,
        balance: Number(balance),
      });
      onCreated(account);
      onClose();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="transaction-modal-backdrop">
      <section className="transaction-modal panel" role="dialog" aria-modal="true" aria-labelledby="account-modal-title">
        <div className="transaction-modal-header">
          <div>
            <h2 id="account-modal-title">Add account</h2>
            <p>Track a cash, bank, savings, or credit account.</p>
          </div>
          <button className="transaction-modal-close" type="button" aria-label="Close account form" onClick={onClose} disabled={isSaving}>
            <X size={19} />
          </button>
        </div>
        <form className="transaction-form" onSubmit={handleSubmit}>
          <label className="transaction-field transaction-field-wide" htmlFor="account-name">
            Account name
            <input id="account-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="e.g. Main savings" required />
          </label>
          <label className="transaction-field" htmlFor="account-type">
            Account type
            <select id="account-type" value={type} onChange={(event) => setType(event.target.value)}>
              <option value="checking">Checking</option>
              <option value="savings">Savings</option>
              <option value="cash">Cash</option>
              <option value="credit">Credit</option>
            </select>
          </label>
          <label className="transaction-field" htmlFor="account-balance">
            Current balance (INR)
            <input id="account-balance" type="number" min="0" max="9999999999.99" step="0.01" value={balance} onChange={(event) => setBalance(event.target.value)} required />
          </label>
          {error && <p className="transaction-form-error" role="alert">{error}</p>}
          <div className="transaction-form-actions">
            <button type="button" className="transaction-cancel-button" onClick={onClose} disabled={isSaving}>Cancel</button>
            <button type="submit" className="add-button" disabled={isSaving}>{isSaving ? "Saving..." : "Save account"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function BudgetForm({ onClose, onCreated }) {
  const now = new Date();
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [periodType, setPeriodType] = useState("MONTHLY");
  const [periodStart, setPeriodStart] = useState(dateKey(now));
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const periodLabels = {
    WEEKLY: "weekly",
    MONTHLY: "monthly",
    BIMONTHLY: "every 2 months",
  };
  const selectedPeriodStart = periodType === "WEEKLY" ? periodStart : `${periodStart.slice(0, 7)}-01`;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSaving(true);
    try {
      const budget = await postApiJson("/api/budgets", {
        category,
        amount: Number(amount),
        month: selectedPeriodStart.slice(0, 7),
        periodType,
        periodStart: selectedPeriodStart,
      });
      onCreated(budget);
      onClose();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="transaction-modal-backdrop">
      <section className="transaction-modal panel" role="dialog" aria-modal="true" aria-labelledby="budget-modal-title">
        <div className="transaction-modal-header">
          <div>
            <h2 id="budget-modal-title">Add {periodLabels[periodType]} budget</h2>
            <p>Set a category limit for the selected budget period.</p>
          </div>
          <button className="transaction-modal-close" type="button" aria-label="Close budget form" onClick={onClose} disabled={isSaving}>
            <X size={19} />
          </button>
        </div>
        <form className="transaction-form" onSubmit={handleSubmit}>
          <label className="transaction-field transaction-field-wide" htmlFor="budget-category">
            Category
            <input id="budget-category" value={category} onChange={(event) => setCategory(event.target.value)} maxLength={60} placeholder="e.g. Food" required />
          </label>
          <label className="transaction-field" htmlFor="budget-amount">
            Budget limit (INR)
            <input id="budget-amount" type="number" min="0.01" max="9999999999.99" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required />
          </label>
          <label className="transaction-field" htmlFor="budget-period-type">
            Budget period
            <select id="budget-period-type" value={periodType} onChange={(event) => setPeriodType(event.target.value)}>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
              <option value="BIMONTHLY">Every 2 months</option>
            </select>
          </label>
          <label className="transaction-field" htmlFor="budget-period-start">
            {periodType === "WEEKLY"
              ? "Week containing"
              : periodType === "BIMONTHLY" ? "Starting month" : "Month"}
            <input
              id="budget-period-start"
              type={periodType === "WEEKLY" ? "date" : "month"}
              value={periodType === "WEEKLY" ? periodStart : periodStart.slice(0, 7)}
              onChange={(event) => setPeriodStart(
                periodType === "WEEKLY" ? event.target.value : `${event.target.value}-01`
              )}
              required
            />
          </label>
          {periodType === "WEEKLY" && <p className="transaction-field-help">Weeks run Monday through Sunday.</p>}
          {periodType === "BIMONTHLY" && <p className="transaction-field-help">Two-month periods begin in January, March, May, July, September, and November.</p>}
          {error && <p className="transaction-form-error" role="alert">{error}</p>}
          <div className="transaction-form-actions">
            <button type="button" className="transaction-cancel-button" onClick={onClose} disabled={isSaving}>Cancel</button>
            <button type="submit" className="add-button" disabled={isSaving}>{isSaving ? "Saving..." : "Save budget"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function App() {
  const [currentPage, setCurrentPage] = useState(() =>
    new URLSearchParams(window.location.search).get("oauth") === "success"
      ? "session-check"
      : new URLSearchParams(window.location.search).has("oauthError")
        ? "login"
        : window.localStorage.getItem(AUTH_STORAGE_KEY) === "true" ? "session-check" : "landing"
  );
  const [activePage, setActivePage] = useState("Dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [logoutError, setLogoutError] = useState("");
  const [userInfo, setUserInfo] = useState({ email: "", phone: "", name: "" });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchError, setSearchError] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [transactionError, setTransactionError] = useState("");
  const [isTransactionFormOpen, setIsTransactionFormOpen] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [accountError, setAccountError] = useState("");
  const [isAccountFormOpen, setIsAccountFormOpen] = useState(false);
  const [budgets, setBudgets] = useState([]);
  const [budgetError, setBudgetError] = useState("");
  const [isBudgetFormOpen, setIsBudgetFormOpen] = useState(false);
  const [budgetPdfPeriod, setBudgetPdfPeriod] = useState("WEEKLY");
  const [budgetPdfError, setBudgetPdfError] = useState("");
  const [transactionPdfPeriod, setTransactionPdfPeriod] = useState("DAILY");
  const [transactionPdfDate, setTransactionPdfDate] = useState(dateKey(new Date()));
  const [transactionPdfError, setTransactionPdfError] = useState("");
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [alertPreferences, setAlertPreferences] = useState({
    highExpenseAlerts: true,
    lowCashFlowAlerts: true,
    notificationSound: false,
  });
  const preferenceStorageKey = `finsight-alerts:${(userInfo.email || userInfo.phone || "personal").trim().toLocaleLowerCase()}`;
  const profilePhotoStorageKey = `finsight-profile-photo:${(userInfo.email || userInfo.phone || "personal").trim().toLocaleLowerCase()}`;
  const profilePhotoZoomStorageKey = `finsight-profile-photo-zoom:${(userInfo.email || userInfo.phone || "personal").trim().toLocaleLowerCase()}`;
  const [profilePhoto, setProfilePhoto] = useState("");
  const [profilePhotoZoom, setProfilePhotoZoom] = useState(1);
  const notificationAudioRef = useRef(null);
  const previousAlertIdsRef = useRef(new Set());

  useEffect(() => {
    setAlertPreferences({
      highExpenseAlerts: window.localStorage.getItem(`${preferenceStorageKey}:highExpenseAlerts`) !== "false",
      lowCashFlowAlerts: window.localStorage.getItem(`${preferenceStorageKey}:lowCashFlowAlerts`) !== "false",
      notificationSound: window.localStorage.getItem(`${preferenceStorageKey}:notificationSound`) === "true",
    });
  }, [preferenceStorageKey]);

  useEffect(() => {
    setProfilePhoto(window.localStorage.getItem(profilePhotoStorageKey) || "");
  }, [profilePhotoStorageKey]);

  useEffect(() => {
    const savedZoom = Number(window.localStorage.getItem(profilePhotoZoomStorageKey));
    setProfilePhotoZoom(Number.isFinite(savedZoom) && savedZoom >= 1 && savedZoom <= 2 ? savedZoom : 1);
  }, [profilePhotoZoomStorageKey]);

  useEffect(() => {
    if (currentPage !== "session-check") return undefined;
    let active = true;
    const checkSession = async () => {
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.has("oauth")) {
          url.searchParams.delete("oauth");
          window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
        }
        const response = await fetch(`${API_BASE_URL}/api/auth/session`, { credentials: "include" });
        const result = await parseApiResponse(response);
        if (!active) return;
        if (result.authenticated) {
          window.localStorage.setItem(AUTH_STORAGE_KEY, "true");
          setUserInfo({
            email: result.email || "",
            phone: result.phone || "",
            name: result.displayName || "",
          });
          setCurrentPage("dashboard");
        } else {
          window.localStorage.removeItem(AUTH_STORAGE_KEY);
          setUserInfo({ email: "", phone: "", name: "" });
          setCurrentPage("landing");
        }
      } catch (error) {
        if (!active) return;
        setSessionError(error.message);
        setCurrentPage("session-error");
      }
    };
    checkSession();
    return () => {
      active = false;
    };
  }, [currentPage]);

  useEffect(() => {
    if (currentPage !== "dashboard") return undefined;
    let active = true;

    const loadList = (path, setItems, setError) => {
      setError("");
      fetch(`${API_BASE_URL}${path}`, { credentials: "include" })
        .then(parseApiResponse)
        .then((result) => {
          if (!Array.isArray(result)) {
            throw new Error("The server returned an invalid list response.");
          }
          if (active) setItems(result);
        })
        .catch((error) => {
          if (active) setError(error.message);
        });
    };

    loadList("/api/transactions", setTransactions, setTransactionError);
    loadList("/api/accounts", setAccounts, setAccountError);
    loadList("/api/budgets", setBudgets, setBudgetError);

    return () => {
      active = false;
    };
  }, [currentPage]);

  useEffect(() => {
    if (currentPage !== "loading") return undefined;
    const loadingTimer = window.setTimeout(() => setCurrentPage("dashboard"), 1600);
    return () => window.clearTimeout(loadingTimer);
  }, [currentPage]);

  const handleLogin = (user = {}) => {
    window.localStorage.setItem(AUTH_STORAGE_KEY, "true");
    setUserInfo({
      email: user.email || "",
      phone: user.phone || "",
      name: user.name || "",
    });
    setCurrentPage("loading");
  };

  const handleTransactionCreated = (transaction) => {
    setTransactionError("");
    setTransactions((current) => [transaction, ...current].sort((left, right) => (
      right.transactionDate.localeCompare(left.transactionDate) || right.id - left.id
    )));
  };

  const handleAccountCreated = (account) => {
    setAccountError("");
    setAccounts((current) => [...current, account].sort((left, right) => left.name.localeCompare(right.name)));
  };

  const handleBudgetCreated = (budget) => {
    setBudgetError("");
    setBudgetPdfError("");
    setBudgets((current) => [...current.filter((item) => item.id !== budget.id), budget].sort((left, right) => (
      right.month.localeCompare(left.month) || left.category.localeCompare(right.category)
    )));
  };

  const handleBudgetPdfDownload = () => {
    setBudgetPdfError("");
    try {
      if (!downloadBudgetPdf(budgets, budgetPdfPeriod)) {
        setBudgetPdfError(`No ${budgetPdfPeriod === "BIMONTHLY" ? "two-month" : budgetPdfPeriod.toLowerCase()} budgets to download yet.`);
      }
    } catch (error) {
      setBudgetPdfError(error instanceof Error ? error.message : "The budget PDF could not be generated.");
    }
  };

  const handleTransactionPdfDownload = () => {
    setTransactionPdfError("");
    try {
      if (!downloadTransactionPdf(transactions, transactionPdfPeriod, transactionPdfDate)) {
        setTransactionPdfError("No transactions found for the selected period.");
      }
    } catch (error) {
      setTransactionPdfError(error instanceof Error ? error.message : "The transaction PDF could not be generated.");
    }
  };

  const handleAlertPreferenceChange = (preference, enabled) => {
    window.localStorage.setItem(`${preferenceStorageKey}:${preference}`, String(enabled));
    setAlertPreferences((current) => ({ ...current, [preference]: enabled }));
  };

  const handleProfilePhotoChange = (photo) => {
    try {
      if (photo) {
        window.localStorage.setItem(profilePhotoStorageKey, photo);
      } else {
        window.localStorage.removeItem(profilePhotoStorageKey);
      }
      setProfilePhoto(photo);
      return true;
    } catch (error) {
      if (error instanceof DOMException) return false;
      throw error;
    }
  };

  const handleProfileUpdated = useCallback((profile) => {
    setUserInfo((current) => ({
      ...current,
      email: profile.email || current.email,
      phone: profile.phone || current.phone,
      name: profile.displayName || current.name,
      age: profile.age ?? null,
      gender: profile.gender || "",
      mobileNumber: profile.mobileNumber || "",
      address: profile.address || "",
    }));
  }, []);

  const handleProfilePhotoZoomChange = (zoom) => {
    window.localStorage.setItem(profilePhotoZoomStorageKey, String(zoom));
    setProfilePhotoZoom(zoom);
  };

  const navigateToPage = (page) => {
    setActivePage(page);
    setMenuOpen(false);
    setIsNotificationsOpen(false);
    setSearchError("");
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const page = findPageForQuery(searchQuery);
    if (!page) {
      setSearchError("No matching page found. Try Dashboard, Transactions, Accounts, Analytics, Budgets, AI Insights, or Profile.");
      return;
    }
    navigateToPage(page);
    setSearchQuery("");
  };

  const handleLogout = () => {
    setLogoutError("");
    fetch(`${API_BASE_URL}/api/auth/logout`, { method: "POST", credentials: "include" })
      .then(parseApiResponse)
      .then(() => {
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
        setTransactions([]);
        setTransactionError("");
        setIsTransactionFormOpen(false);
        setUserInfo({ email: "", phone: "", name: "" });
        setAccounts([]);
        setAccountError("");
        setIsAccountFormOpen(false);
        setBudgets([]);
        setBudgetError("");
        setIsBudgetFormOpen(false);
        setIsNotificationsOpen(false);
        setActivePage("Dashboard");
        setMenuOpen(false);
        setCurrentPage("landing");
      })
      .catch((error) => setLogoutError(error.message));
  };

  const dashboardAnalytics = getAnalyticsData(transactions);
  const currentMonthSummary = getCurrentMonthSummary(transactions, budgets);
  const financialAlerts = getFinancialAlerts(currentMonthSummary, alertPreferences);
  const transactionPdfRange = getTransactionReportRange(transactionPdfPeriod, transactionPdfDate);
  const transactionPdfCount = transactions.filter((transaction) => (
    transaction.transactionDate >= transactionPdfRange.start && transaction.transactionDate <= transactionPdfRange.end
  )).length;
  const budgetPdfCount = budgets.filter((budget) => (
    (budget.periodType || "MONTHLY").toUpperCase() === budgetPdfPeriod
  )).length;
  const accountBalance = accounts.reduce((total, account) => total + Number(account.balance || 0), 0);
  const hasFinancialData = transactions.length > 0 || accounts.length > 0 || budgets.length > 0;
  const greetingName = getGreetingName(userInfo);
  const profileContact = userInfo.email || userInfo.phone || "Personal account";
  const avatarInitial = greetingName === "there" ? "U" : greetingName.charAt(0).toUpperCase();
  const welcomeDate = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());
  const stats = [
    {
      title: "Total Balance",
      value: CURRENCY_FORMATTER.format(accountBalance),
      description: accounts.length === 0 ? "Add an account to see your balance" : `Across ${accounts.length} account${accounts.length === 1 ? "" : "s"}`,
      icon: Wallet,
      className: "balance-card",
    },
    {
      title: "Total Income",
      value: CURRENCY_FORMATTER.format(dashboardAnalytics.income),
      description: "From your saved transactions",
      icon: TrendingUp,
      className: "income-card",
    },
    {
      title: "Total Expenses",
      value: CURRENCY_FORMATTER.format(dashboardAnalytics.expenses),
      description: "From your saved transactions",
      icon: TrendingDown,
      className: "expense-card",
    },
    {
      title: "Net Cash Flow",
      value: CURRENCY_FORMATTER.format(dashboardAnalytics.net),
      description: "Income minus expenses",
      icon: Target,
      className: "savings-card",
    },
  ];

  useEffect(() => {
    const alertIds = new Set(financialAlerts.map((alert) => alert.id));
    const hasNewAlert = [...alertIds].some((id) => !previousAlertIdsRef.current.has(id));
    previousAlertIdsRef.current = alertIds;
    if (!hasNewAlert || !alertPreferences.notificationSound || currentPage !== "dashboard") return;

    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) return;
    try {
      const audioContext = notificationAudioRef.current || new AudioContextConstructor();
      notificationAudioRef.current = audioContext;
      const playSound = async () => {
        if (audioContext.state === "suspended") await audioContext.resume();
        const oscillator = audioContext.createOscillator();
        const volume = audioContext.createGain();
        const startTime = audioContext.currentTime;
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(880, startTime);
        volume.gain.setValueAtTime(0.08, startTime);
        volume.gain.exponentialRampToValueAtTime(0.001, startTime + 0.16);
        oscillator.connect(volume);
        volume.connect(audioContext.destination);
        oscillator.start(startTime);
        oscillator.stop(startTime + 0.16);
      };
      playSound().catch((error) => console.warn("Could not play the financial alert sound.", error));
    } catch (error) {
      console.warn("Could not play the financial alert sound.", error);
    }
  }, [alertPreferences.notificationSound, currentPage, financialAlerts]);

  if (currentPage === "landing") {
    return <LandingPage onLogin={() => setCurrentPage("login")} />;
  }

  if (currentPage === "login") {
    return (
      <Login
        onLogin={handleLogin}
        onBackToLanding={() => setCurrentPage("landing")}
      />
    );
  }

  if (currentPage === "loading") {
    return <LoadingPage onBackToLogin={() => setCurrentPage("login")} />;
  }

  if (currentPage === "session-check") {
    return <LoadingPage onBackToLogin={() => setCurrentPage("landing")} />;
  }

  if (currentPage === "session-error") {
    return (
      <SessionErrorPage
        message={sessionError}
        onRetry={() => setCurrentPage("session-check")}
        onReturnToLanding={() => setCurrentPage("landing")}
      />
    );
  }

  return (
    <div className="app-shell">

      {/* MOBILE MENU BUTTON */}
      <button
        className="mobile-menu"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Toggle menu"
      >
        {menuOpen ? <X /> : <Menu />}
      </button>

      {/* SIDEBAR */}
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-icon">
            <Wallet size={23} />
          </div>
          <div>
            <h2>Fin<span>Sight</span></h2>
            <p>PERSONAL FINANCE</p>
          </div>
        </div>

        <div className="sidebar-label">MENU</div>

        <nav className="navigation">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.name}
                className={`nav-item ${
                  activePage === item.name ? "active" : ""
                }`}
                aria-current={activePage === item.name ? "page" : undefined}
                onClick={() => navigateToPage(item.name)}
              >
                <Icon size={19} />
                <span>{item.name}</span>
                {item.name === "AI Insights" && (
                  <span className="ai-badge">AI</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="upgrade-card">
            <div className="upgrade-icon">
              <Sparkles size={22} />
            </div>
            <h3>Smarter Finances</h3>
            <p>Your money, your future. Make every decision smarter.</p>
            <button type="button" onClick={() => navigateToPage("AI Insights")}>
              Explore AI <ArrowUpRight size={15} />
            </button>
          </div>

          <button
            className={`nav-item settings-button ${activePage === "Profile" ? "active" : ""}`}
            type="button"
            onClick={() => navigateToPage("Profile")}
          >
            <Settings size={19} />
            <span>Settings</span>
          </button>

          <div className="profile">
            <button
              className="profile-trigger"
              type="button"
              aria-label={`Open profile for ${greetingName}`}
              onClick={() => {
                navigateToPage("Profile");
              }}
            >
              <div className="avatar profile-photo">
                {profilePhoto ? <img src={profilePhoto} alt="" style={{ transform: `scale(${profilePhotoZoom})` }} /> : avatarInitial}
              </div>
              <div className="profile-info">
                <strong>{greetingName === "there" ? "Your account" : greetingName}</strong>
                <span>{profileContact}</span>
              </div>
            </button>
            <button
              className="profile-dots sign-out-button"
              type="button"
              onClick={handleLogout}
              aria-label="Sign out"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main-content">
        {logoutError && <p className="session-error-message" role="alert">{logoutError}</p>}
        {searchError && <p className="search-error-message" role="alert">{searchError}</p>}

        {/* TOP NAVBAR */}
        <header className="topbar">
          <div className="page-heading">
            <span className="breadcrumb">Workspace /</span>
            <h1>{activePage}</h1>
          </div>

          <div className="top-actions">
            {activePage !== "Dashboard" && (
              <button
                className="dashboard-nav-button"
                type="button"
                aria-label="Go to Dashboard"
                onClick={() => navigateToPage("Dashboard")}
              >
                <LayoutDashboard size={16} />
                <span>Dashboard</span>
              </button>
            )}
            <form className="search-box" role="search" onSubmit={handleSearchSubmit}>
              <button type="submit" aria-label="Search pages"><Search size={17} /></button>
              <input
                aria-label="Search pages"
                autoComplete="off"
                placeholder="Search pages..."
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setSearchError("");
                }}
              />
              <span>Ctrl K</span>
            </form>

            <div className="notification-wrap">
              <button
                className="notification-button"
                type="button"
                aria-label={`Notifications${financialAlerts.length ? `, ${financialAlerts.length} alerts` : ""}`}
                aria-expanded={isNotificationsOpen}
                aria-controls="financial-notifications"
                onClick={() => setIsNotificationsOpen((open) => !open)}
              >
                <Bell size={19} />
                {financialAlerts.length > 0 && (
                  <span className="notification-count">{financialAlerts.length}</span>
                )}
              </button>
              {isNotificationsOpen && (
                <section className="notification-popover" id="financial-notifications" aria-label="Financial notifications">
                  <div className="notification-popover-header">
                    <div>
                      <strong>Notifications</strong>
                      <span>{financialAlerts.length ? `${financialAlerts.length} financial alert${financialAlerts.length === 1 ? "" : "s"}` : "You're all caught up"}</span>
                    </div>
                    <button
                      type="button"
                      className="notification-close"
                      aria-label="Close notifications"
                      onClick={() => setIsNotificationsOpen(false)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                  {transactionError || budgetError ? (
                    <p className="notification-empty" role="alert">
                      Alerts may be incomplete: {transactionError || budgetError}
                    </p>
                  ) : financialAlerts.length > 0 ? (
                    <div className="notification-list">
                      {financialAlerts.map((alert) => (
                        <article className={`notification-item notification-${alert.tone}`} key={alert.id}>
                          <span className="notification-item-icon"><Bell size={15} /></span>
                          <div>
                            <strong>{alert.title}</strong>
                            <p>{alert.message}</p>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="notification-empty">No high-expense or low-cash-flow alerts right now.</p>
                  )}
                  <button
                    className="notification-settings-link"
                    type="button"
                    onClick={() => navigateToPage("Profile")}
                  >
                    Manage alert settings
                  </button>
                </section>
              )}
            </div>

            <button
              className="top-avatar top-avatar-button"
              type="button"
              aria-label="Open profile"
              onClick={() => navigateToPage("Profile")}
            >
              {profilePhoto ? <img src={profilePhoto} alt="" style={{ transform: `scale(${profilePhotoZoom})` }} /> : avatarInitial}
            </button>
          </div>
        </header>

        {/* DASHBOARD */}
        {activePage === "Dashboard" ? (
          <>
            <section className="welcome-section">
              <div>
                <p className="welcome-date">
                  <CalendarDays size={15} /> {welcomeDate}
                </p>
                <h2>Welcome, {greetingName}!</h2>
                <p className="welcome-subtitle">
                  {hasFinancialData
                    ? "Here's what's happening with your money today."
                    : "Your dashboard is ready. Add your first transaction, account, or budget to get started."}
                </p>
              </div>

              <button className="add-button" type="button" onClick={() => setIsTransactionFormOpen(true)}>
                <Plus size={18} /> Add Transaction
              </button>
            </section>
            {(transactionError || accountError || budgetError) && (
              <p className="transaction-form-error" role="alert">
                {transactionError || accountError || budgetError}
              </p>
            )}

            {/* STAT CARDS */}
            <section className="stats-grid">
              {stats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <motion.div
                    key={stat.title}
                    className={`stat-card ${stat.className}`}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ y: -5 }}
                  >
                    <div className="stat-top">
                      <div className="stat-icon">
                        <Icon size={21} />
                      </div>
                    </div>
                    <p className="stat-title">{stat.title}</p>
                    <h2>{stat.value}</h2>
                    <p className="stat-description">
                      {stat.description}
                    </p>
                    {stat.title === "Total Balance" && accounts.length === 0 && (
                      <button
                        className="stat-action"
                        type="button"
                        onClick={() => setIsAccountFormOpen(true)}
                      >
                        Add starting balance
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </section>

            {/* CHARTS */}
            <section className="charts-grid">
              <div className="panel spending-panel">
                <div className="panel-header">
                  <div>
                    <h3>Income and expenses</h3>
                    <p>Saved activity over the last six months</p>
                  </div>
                </div>

                {dashboardAnalytics.monthly.some((month) => month.income > 0 || month.expenses > 0) ? (
                  <>
                    <div className="chart-legend">
                      <span><i className="legend-income" /> Income</span>
                      <span><i className="legend-expense" /> Expenses</span>
                    </div>
                    <div className="area-chart">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={dashboardAnalytics.monthly}>
                          <defs>
                            <linearGradient id="dashboardIncomeGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#9b7bff" stopOpacity={0.35} />
                              <stop offset="95%" stopColor="#9b7bff" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="dashboardExpenseGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#38d9b2" stopOpacity={0.2} />
                              <stop offset="95%" stopColor="#38d9b2" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke="#292d40" strokeDasharray="4 5" vertical={false} />
                          <XAxis dataKey="label" stroke="#777d94" tickLine={false} axisLine={false} />
                          <YAxis
                            stroke="#777d94"
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => CURRENCY_FORMATTER.format(value)}
                            width={82}
                          />
                          <Tooltip
                            contentStyle={{
                              background: "#202438",
                              border: "1px solid #363b54",
                              borderRadius: "12px",
                              color: "#fff",
                            }}
                            formatter={(value, name) => [
                              CURRENCY_FORMATTER.format(value),
                              name === "income" ? "Income" : "Expenses",
                            ]}
                          />
                          <Area type="monotone" dataKey="income" stroke="#a78bfa" strokeWidth={3} fill="url(#dashboardIncomeGradient)" />
                          <Area type="monotone" dataKey="expenses" stroke="#38d9b2" strokeWidth={3} fill="url(#dashboardExpenseGradient)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                ) : (
                  <p className="analytics-empty">Your income and expenses will appear here as you add transactions.</p>
                )}
              </div>

              {/* CATEGORY CHART */}
              <div className="panel category-panel">
                <div className="panel-header">
                  <div>
                    <h3>Spending Categories</h3>
                    <p>Your saved expenses by category</p>
                  </div>
                </div>

                {dashboardAnalytics.categories.length > 0 ? (
                  <>
                    <div className="donut-container">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={dashboardAnalytics.categories}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={65}
                            outerRadius={90}
                            paddingAngle={5}
                            stroke="none"
                          >
                            {dashboardAnalytics.categories.map((item) => (
                              <Cell key={item.name} fill={item.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              background: "#202438",
                              border: "1px solid #363b54",
                              borderRadius: "10px",
                              color: "#fff",
                            }}
                            formatter={(value) => CURRENCY_FORMATTER.format(value)}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="donut-center">
                        <span>Total Spent</span>
                        <strong>{CURRENCY_FORMATTER.format(dashboardAnalytics.expenses)}</strong>
                      </div>
                    </div>

                    <div className="category-legend">
                      {dashboardAnalytics.categories.slice(0, 4).map((item) => (
                        <div className="category-row" key={item.name}>
                          <span>
                            <i style={{ background: item.color }}></i>
                            {item.name}
                          </span>
                          <strong>{Math.round((item.value / dashboardAnalytics.expenses) * 100)}%</strong>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="analytics-empty">Add an expense to see your spending categories.</p>
                )}
              </div>
            </section>

            {/* BOTTOM SECTION */}
            <section className="bottom-grid">
              <div className="panel transactions-panel">
                <div className="panel-header">
                  <div>
                    <h3>Recent Transactions</h3>
                    <p>Your latest financial activity</p>
                  </div>
                </div>

                {transactionError && <p className="transaction-form-error" role="alert">{transactionError}</p>}
                <div className="transaction-list">
                  <TransactionList transactions={transactions.slice(0, 5)} />
                </div>
              </div>

              {/* AI INSIGHT */}
              <motion.div
                className="panel ai-panel"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <div className="ai-heading">
                  <div className="ai-sparkle"><Sparkles size={23} /></div>
                  <span>FINSIGHT</span>
                  <span className="live-badge"><i className="live-dot" /> LIVE</span>
                </div>

                <h3>{hasFinancialData ? <>Your money has a story.<br />Let's understand it.</> : <>Your fresh start<br />begins here.</>}</h3>
                <p>
                  {hasFinancialData
                    ? "Use your saved transactions and Analytics to understand your spending patterns and plan your next steps."
                    : "Add your first transaction, account, or budget to build a clear picture of your finances."}
                </p>

                <div className="ai-tip">
                  <div className="tip-icon"><TrendingUp size={19} /></div>
                  <div>
                    <strong>{transactions.length > 0 ? "Keep your records current" : "Start with one entry"}</strong>
                    <span>{transactions.length > 0 ? "Add income and expenses as they happen to keep your overview useful." : "A transaction is an easy first step toward understanding your money."}</span>
                  </div>
                </div>

                <button
                  className="ai-button"
                  onClick={() => setActivePage("AI Insights")}
                >
                  Explore AI Insights <ArrowUpRight size={17} />
                </button>
              </motion.div>
            </section>

            <footer className="dashboard-footer">
              <span>Copyright 2026 FinSight. Smart money, smarter future.</span>
              <span>Made for your financial wellness</span>
            </footer>
          </>
        ) : activePage === "Transactions" ? (
          <section className="transactions-page panel">
            <div className="transactions-page-header">
              <div>
                <h2>All transactions</h2>
                <p>Income and expenses saved to your account.</p>
              </div>
              <div className="transaction-page-actions">
                <div className="transaction-export-controls">
                  <label className="transaction-export-period" htmlFor="transaction-pdf-period">
                    PDF period
                    <select
                      id="transaction-pdf-period"
                      value={transactionPdfPeriod}
                      onChange={(event) => {
                        setTransactionPdfPeriod(event.target.value);
                        setTransactionPdfError("");
                      }}
                    >
                      <option value="DAILY">Day-wise</option>
                      <option value="WEEKLY">Weekly</option>
                      <option value="MONTHLY">Monthly</option>
                    </select>
                  </label>
                  <label className="transaction-export-period" htmlFor="transaction-pdf-date">
                    {transactionPdfPeriod === "WEEKLY" ? "Week containing" : transactionPdfPeriod === "MONTHLY" ? "Month" : "Date"}
                    <input
                      id="transaction-pdf-date"
                      type={transactionPdfPeriod === "MONTHLY" ? "month" : "date"}
                      value={transactionPdfPeriod === "MONTHLY" ? transactionPdfDate.slice(0, 7) : transactionPdfDate}
                      onChange={(event) => {
                        setTransactionPdfDate(transactionPdfPeriod === "MONTHLY" ? `${event.target.value}-01` : event.target.value);
                        setTransactionPdfError("");
                      }}
                    />
                  </label>
                  <button
                    className="profile-secondary-button"
                    type="button"
                    onClick={handleTransactionPdfDownload}
                    disabled={transactionPdfCount === 0}
                  >
                    Download PDF
                  </button>
                  <span className="transaction-export-count" aria-live="polite">
                    {transactionPdfCount === 0
                      ? "No transactions in period"
                      : `${transactionPdfCount} transaction${transactionPdfCount === 1 ? "" : "s"} in period`}
                  </span>
                </div>
                <button className="add-button" type="button" onClick={() => setIsTransactionFormOpen(true)}>
                  <Plus size={18} /> Add Transaction
                </button>
              </div>
            </div>
            {transactionError && <p className="transaction-form-error" role="alert">{transactionError}</p>}
            {transactionPdfError && <p className="transaction-form-error" role="alert">{transactionPdfError}</p>}
            <div className="transaction-list">
              <TransactionList transactions={transactions} />
            </div>
          </section>
        ) : activePage === "Accounts" ? (
          <section className="transactions-page panel">
            <div className="transactions-page-header">
              <div>
                <h2>Your accounts</h2>
                <p>Track account balances in Indian rupees.</p>
              </div>
              <button className="add-button" type="button" onClick={() => setIsAccountFormOpen(true)}>
                <Plus size={18} /> Add Account
              </button>
            </div>
            {accountError && <p className="transaction-form-error" role="alert">{accountError}</p>}
            <AccountList accounts={accounts} />
          </section>
        ) : activePage === "Analytics" ? (
          <AnalyticsView transactions={transactions} error={transactionError} />
        ) : activePage === "Budgets" ? (
          <section className="transactions-page panel">
            <div className="transactions-page-header">
              <div>
                <h2>Budgets</h2>
                <p>Create weekly, monthly, or two-month category limits and download PDF reports.</p>
              </div>
              <div className="budget-actions">
                <button className="add-button" type="button" onClick={() => setIsBudgetFormOpen(true)}>
                  <Plus size={18} /> Add Budget
                </button>
                <label className="budget-export-period" htmlFor="budget-pdf-period">
                  PDF period
                  <select
                    id="budget-pdf-period"
                    value={budgetPdfPeriod}
                    onChange={(event) => {
                      setBudgetPdfPeriod(event.target.value);
                      setBudgetPdfError("");
                    }}
                  >
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="BIMONTHLY">Every 2 months</option>
                  </select>
                </label>
                <button className="profile-secondary-button" type="button" onClick={handleBudgetPdfDownload} disabled={budgetPdfCount === 0}>
                  Download PDF
                </button>
              </div>
            </div>
            {budgetError && <p className="transaction-form-error" role="alert">{budgetError}</p>}
            {budgetPdfError && <p className="transaction-form-error" role="alert">{budgetPdfError}</p>}
            <BudgetList budgets={budgets} />
          </section>
        ) : activePage === "AI Insights" ? (
          <AiInsightsView
            monthSummary={currentMonthSummary}
            onViewTransactions={() => setActivePage("Transactions")}
          />
        ) : activePage === "Profile" ? (
          <ProfileView
            userInfo={userInfo}
            greetingName={greetingName}
            preferences={alertPreferences}
            profilePhoto={profilePhoto}
            profilePhotoZoom={profilePhotoZoom}
            onPreferenceChange={handleAlertPreferenceChange}
            onProfileUpdated={handleProfileUpdated}
            onProfilePhotoChange={handleProfilePhotoChange}
            onProfilePhotoZoomChange={handleProfilePhotoZoomChange}
            onLogout={handleLogout}
          />
        ) : (
          <section className="coming-soon panel">
            <div className="coming-icon"><Sparkles size={32} /></div>
            <h2>{activePage}</h2>
            <p>This section is ready for the next development milestone.</p>
            <button className="add-button" type="button" onClick={() => setActivePage("Dashboard")}>
              Back to Dashboard
            </button>
          </section>
        )}
      </main>
      {isTransactionFormOpen && (
        <TransactionForm
          onClose={() => setIsTransactionFormOpen(false)}
          onCreated={handleTransactionCreated}
        />
      )}
      {isAccountFormOpen && (
        <AccountForm
          onClose={() => setIsAccountFormOpen(false)}
          onCreated={handleAccountCreated}
        />
      )}
      {isBudgetFormOpen && (
        <BudgetForm
          onClose={() => setIsBudgetFormOpen(false)}
          onCreated={handleBudgetCreated}
        />
      )}
    </div>
  );
}

export default App;