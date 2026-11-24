// React application for authenticated finance, profile, and account workflows.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  History,
  MessageCircle,
  Send,
  Search,
  Plus,
  TrendingUp,
  TrendingDown,
  Menu,
  X,
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Trash2,
} from "lucide-react";
import { API_BASE_URL } from "./apiBaseUrl";
import { LANGUAGES, matchesAssistantIntent, translate } from "./i18n";
import "./App.css";

const CashFlowChart = React.lazy(() => import("./FinanceCharts").then((module) => ({
  default: module.CashFlowChart,
})));
const SpendingCategoryChart = React.lazy(() => import("./FinanceCharts").then((module) => ({
  default: module.SpendingCategoryChart,
})));

const navigation = [
  { name: "Dashboard", icon: LayoutDashboard },
  { name: "Transactions", icon: ArrowLeftRight },
  { name: "Accounts", icon: Wallet },
  { name: "Analytics", icon: ChartNoAxesCombined },
  { name: "Budgets", icon: Target },
  { name: "AI Insights", icon: Sparkles },
  { name: "AI Assistant", icon: MessageCircle },
  { name: "Profile", icon: UserRound },
];
const PAGE_TRANSLATION_KEYS = {
  Dashboard: "dashboard",
  Transactions: "transactions",
  Accounts: "accounts",
  Analytics: "analytics",
  Budgets: "budgets",
  "AI Insights": "insights",
  "AI Assistant": "assistant",
  Profile: "profile",
  Settings: "settings",
};

const AUTH_STORAGE_KEY = "finsight-authenticated";
const LANGUAGE_STORAGE_KEY = "finsight-language";
const HIGH_EXPENSE_RATIO = 0.8;
const LOW_CASH_FLOW_RATIO = 0.1;
const HIGH_EXPENSE_AMOUNT = 10000;
const APP_THEMES = ["dark", "light", "gray"];
const DASHBOARD_COLORS = [
  { name: "Violet", value: "#9b7bff" },
  { name: "Mint", value: "#38d9b2" },
  { name: "Ocean", value: "#5e9cff" },
  { name: "Rose", value: "#ff7f9f" },
  { name: "Amber", value: "#ffb86b" },
  { name: "Coral", value: "#ff735c" },
  { name: "Sky", value: "#45c7f0" },
  { name: "Indigo", value: "#5969d6" },
  { name: "Lime", value: "#a6d854" },
  { name: "Teal", value: "#17a2a4" },
  { name: "Magenta", value: "#d66adf" },
  { name: "Slate", value: "#7e8da5" },
  { name: "Gray", value: "#858b96" },
  { name: "Graphite", value: "#626a73" },
  { name: "Crimson", value: "#e84855" },
  { name: "Tangerine", value: "#f28c28" },
  { name: "Gold", value: "#f2c94c" },
  { name: "Chartreuse", value: "#b3d334" },
  { name: "Emerald", value: "#00a878" },
  { name: "Forest", value: "#208b3a" },
  { name: "Aqua", value: "#2dd4bf" },
  { name: "Cyan", value: "#22d3ee" },
  { name: "Azure", value: "#2d9cdb" },
  { name: "Cobalt", value: "#3465d9" },
  { name: "Royal", value: "#4169e1" },
  { name: "Periwinkle", value: "#7c83fd" },
  { name: "Lavender", value: "#b388ff" },
  { name: "Orchid", value: "#c77dff" },
  { name: "Plum", value: "#9d4edd" },
  { name: "Fuchsia", value: "#e63ec9" },
  { name: "Raspberry", value: "#d63384" },
  { name: "Brick", value: "#c44536" },
  { name: "Copper", value: "#c2774a" },
  { name: "Seafoam", value: "#5de0a5" },
];
const CURRENCY_FORMATTER = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
});
const ANALYTICS_COLORS = ["#9b7bff", "#38d9b2", "#ffb86b", "#5e9cff", "#ff7f9f", "#7ed6df"];

function getComplementaryColor(hexColor) {
  const match = /^#([0-9a-f]{6})$/i.exec(hexColor);
  if (!match) return "#64a4ff";

  const color = match[1];
  const red = parseInt(color.slice(0, 2), 16) / 255;
  const green = parseInt(color.slice(2, 4), 16) / 255;
  const blue = parseInt(color.slice(4, 6), 16) / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const lightness = (maximum + minimum) / 2;
  const difference = maximum - minimum;
  let hue = 0;
  let saturation = 0;

  if (difference !== 0) {
    saturation = difference / (1 - Math.abs(2 * lightness - 1));
    if (maximum === red) hue = ((green - blue) / difference) % 6;
    else if (maximum === green) hue = (blue - red) / difference + 2;
    else hue = (red - green) / difference + 4;
    hue = (hue * 60 + 360) % 360;
  }

  hue = (hue + 180) % 360;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const hueSection = hue / 60;
  const secondary = chroma * (1 - Math.abs((hueSection % 2) - 1));
  const matchValue = lightness - chroma / 2;
  let rgb;
  if (hueSection < 1) rgb = [chroma, secondary, 0];
  else if (hueSection < 2) rgb = [secondary, chroma, 0];
  else if (hueSection < 3) rgb = [0, chroma, secondary];
  else if (hueSection < 4) rgb = [0, secondary, chroma];
  else if (hueSection < 5) rgb = [secondary, 0, chroma];
  else rgb = [chroma, 0, secondary];

  return `#${rgb.map((channel) => (
    Math.round((channel + matchValue) * 255).toString(16).padStart(2, "0")
  )).join("")}`;
}

function getContrastingTextColor(hexColor) {
  const channels = hexColor.slice(1).match(/.{2}/g)?.map((channel) => parseInt(channel, 16) / 255);
  if (!channels || channels.length !== 3) return "#10121e";
  const luminance = channels
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
    .reduce((total, channel) => total + channel, 0);
  return luminance > 0.38 ? "#171421" : "#ffffff";
}

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

function getDashboardPeriodRange(period, selectedDate) {
  const now = new Date();
  const selected = selectedDate ? new Date(`${selectedDate}T00:00:00`) : now;
  const date = Number.isNaN(selected.getTime()) ? now : selected;
  let start;
  let end;
  if (period === "WEEKLY") {
    start = new Date(date);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    end = new Date(start);
    end.setDate(end.getDate() + 6);
  } else if (period === "YEARLY") {
    start = new Date(date.getFullYear(), 0, 1);
    end = new Date(date.getFullYear(), 11, 31);
  } else {
    start = new Date(date.getFullYear(), date.getMonth(), 1);
    end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  }
  const dateFormatter = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const label = period === "YEARLY"
    ? String(date.getFullYear())
    : `${dateFormatter.format(start)} – ${dateFormatter.format(end)}`;
  return { start: dateKey(start), end: dateKey(end), label };
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

function readStoredNotifications(storageKey) {
  const storedValue = window.localStorage.getItem(storageKey);
  if (storedValue === null) return [];

  let notifications;
  try {
    notifications = JSON.parse(storedValue);
  } catch {
    throw new Error("Saved notifications could not be read. Clear this account's browser notification data to continue.");
  }
  if (
    !Array.isArray(notifications)
    || notifications.some((notification) => (
      !notification
      || typeof notification.id !== "string"
      || typeof notification.sourceId !== "string"
      || typeof notification.title !== "string"
      || typeof notification.message !== "string"
      || typeof notification.tone !== "string"
      || typeof notification.createdAt !== "string"
      || typeof notification.read !== "boolean"
      || typeof notification.dismissed !== "boolean"
    ))
  ) {
    throw new Error("Saved notifications have an invalid format. Clear this account's browser notification data to continue.");
  }
  return notifications;
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

function getAssistantResponse(query, context, language) {
  const normalized = query.toLocaleLowerCase();
  const period = context.rangeLabel;
  const matches = (intent) => matchesAssistantIntent(language, intent, normalized);
  const format = (key, values) => translate(language, key, values);
  const expensesByCategory = context.transactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((totals, transaction) => {
      const category = transaction.category?.trim() || "Uncategorized";
      totals.set(category, (totals.get(category) || 0) + Number(transaction.amount || 0));
      return totals;
    }, new Map());

  if (/\b(?:purpose|propose|proposal)\b|what is finsight|what does this (app|application)|what can this (app|application)/.test(normalized) || matches("purpose")) {
    return format("purposeAnswer");
  }
  if ((/top|most|category|where/.test(normalized) && /spend|expense|category|where/.test(normalized)) || matches("category")) {
    const topCategory = [...expensesByCategory.entries()].sort((left, right) => right[1] - left[1])[0];
    return topCategory
      ? format("categoryAnswer", { category: topCategory[0], period, amount: CURRENCY_FORMATTER.format(topCategory[1]) })
      : format("noCategoryAnswer", { period });
  }
  if (/income|earn|salary|received/.test(normalized) || matches("income")) {
    return format("incomeAnswer", { amount: CURRENCY_FORMATTER.format(context.income), period });
  }
  if (/expense|spend|spent|purchase/.test(normalized) || matches("expenses")) {
    return format("expensesAnswer", { amount: CURRENCY_FORMATTER.format(context.expenses), period });
  }
  if (/cash flow|cashflow|net|left over|surplus/.test(normalized) || matches("cashFlow")) {
    const net = context.income - context.expenses;
    return format("cashFlowAnswer", {
      net: CURRENCY_FORMATTER.format(net),
      income: CURRENCY_FORMATTER.format(context.income),
      expenses: CURRENCY_FORMATTER.format(context.expenses),
      period,
    });
  }
  if (/budget|limit/.test(normalized) || matches("budget")) {
    return context.budgets.length
      ? format("budgetsAnswer", {
        count: context.budgets.length,
        period,
        amount: CURRENCY_FORMATTER.format(context.expenses),
      })
      : format("noBudgetsAnswer");
  }
  if (/balance|account/.test(normalized) || matches("balance")) {
    return format("balanceAnswer", { amount: CURRENCY_FORMATTER.format(context.balance), period });
  }
  return format("assistantFallback");
}

function AiAssistantView({ context, language }) {
  const [messages, setMessages] = useState([{
    role: "assistant",
    text: translate(language, "assistantGreeting", { period: context.rangeLabel }),
  }]);
  const [question, setQuestion] = useState("");
  const messagesRef = useRef(null);
  const suggestions = [
    translate(language, "assistantPurposeQuestion"),
    translate(language, "assistantSpendQuestion"),
    translate(language, "assistantIncomeQuestion"),
    translate(language, "assistantTopCategoryQuestion"),
    translate(language, "assistantCashFlowQuestion"),
  ];

  useEffect(() => {
    const messagesElement = messagesRef.current;
    if (messagesElement) messagesElement.scrollTop = messagesElement.scrollHeight;
  }, [messages]);

  const askQuestion = (value) => {
    const prompt = value.trim();
    if (!prompt) return;
    setMessages((current) => [
      ...current,
      { role: "user", text: prompt },
      { role: "assistant", text: getAssistantResponse(prompt, context, language) },
    ]);
    setQuestion("");
  };

  return (
    <section className="assistant-page">
      <div className="transactions-page-header">
        <div>
          <h2>{translate(language, "assistant")}</h2>
          <p>{translate(language, "assistantDescription", { period: context.rangeLabel })}</p>
        </div>
      </div>
      <div className="assistant-chat panel">
        <div ref={messagesRef} className="assistant-messages" aria-live="polite" aria-label="Conversation">
          {messages.map((message, index) => (
            <div className={`assistant-message assistant-message-${message.role}`} key={`${message.role}-${index}`}>
              {message.role === "assistant" && <span className="assistant-message-icon"><Sparkles size={16} /></span>}
              <p>{message.text}</p>
            </div>
          ))}
        </div>
        <div className="assistant-suggestions" aria-label="Suggested questions">
          {suggestions.map((suggestion) => (
            <button type="button" key={suggestion} onClick={() => askQuestion(suggestion)}>
              {suggestion}
            </button>
          ))}
        </div>
        <form
          className="assistant-composer"
          onSubmit={(event) => {
            event.preventDefault();
            askQuestion(question);
          }}
        >
          <label className="visually-hidden" htmlFor="assistant-question">{translate(language, "assistant")}</label>
          <input
            id="assistant-question"
            type="text"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={translate(language, "askFinances")}
          />
          <button type="submit" aria-label="Send question" disabled={!question.trim()}>
            <Send size={17} />
          </button>
        </form>
        <p className="assistant-disclaimer">{translate(language, "assistantDisclaimer")}</p>
      </div>
    </section>
  );
}

function ProfileView({
  pageMode,
  userInfo,
  greetingName,
  language,
  onLanguageChange,
  preferences,
  appPreferences,
  profilePhoto,
  profilePhotoZoom,
  onProfilePhotoView,
  onPreferenceChange,
  onAppPreferenceChange,
  onProfileUpdated,
  onProfilePhotoChange,
  onProfilePhotoZoomChange,
  onLogout,
  onDeleteAccount,
  onNavigate,
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
  const [loginHistory, setLoginHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState("");
  const [dashboardColorDraft, setDashboardColorDraft] = useState(appPreferences.dashboardColor);
  const [pendingDashboardColor, setPendingDashboardColor] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [cameraStream, setCameraStream] = useState(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isOpeningCamera, setIsOpeningCamera] = useState(false);
  const [isPhotoHoldActive, setIsPhotoHoldActive] = useState(false);
  const initialDisplayName = useRef(userInfo.name || "");
  const isMountedRef = useRef(true);
  const photoInputRef = useRef(null);
  const photoViewTimeoutRef = useRef(null);
  const profileNameInputRef = useRef(null);
  const cameraVideoRef = useRef(null);

  useEffect(() => {
    setDashboardColorDraft(appPreferences.dashboardColor);
  }, [appPreferences.dashboardColor]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (photoViewTimeoutRef.current !== null) {
        window.clearTimeout(photoViewTimeoutRef.current);
      }
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

  useEffect(() => {
    let active = true;
    setIsLoadingHistory(true);
    setHistoryError("");
    getApiJson("/api/auth/history")
      .then((history) => {
        if (!Array.isArray(history)) {
          throw new Error("The server returned an invalid login history response.");
        }
        if (active) setLoginHistory(history);
      })
      .catch((error) => {
        if (active) setHistoryError(error.message);
      })
      .finally(() => {
        if (active) setIsLoadingHistory(false);
      });
    return () => {
      active = false;
    };
  }, [userInfo.email, userInfo.phone]);

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

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    setDeleteAccountError("");
    try {
      await onDeleteAccount();
    } catch (error) {
      setDeleteAccountError(error.message);
      setIsDeletingAccount(false);
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

  const startPhotoViewHold = () => {
    if (!profilePhoto || photoViewTimeoutRef.current !== null) return;
    setIsPhotoHoldActive(true);
    photoViewTimeoutRef.current = window.setTimeout(() => {
      photoViewTimeoutRef.current = null;
      setIsPhotoHoldActive(false);
      onProfilePhotoView();
    }, 1000);
  };

  const cancelPhotoViewHold = () => {
    if (photoViewTimeoutRef.current !== null) {
      window.clearTimeout(photoViewTimeoutRef.current);
      photoViewTimeoutRef.current = null;
    }
    setIsPhotoHoldActive(false);
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
          <h2>
            {pageMode === "Profile"
              ? translate(language, "profileTitle")
              : translate(language, PAGE_TRANSLATION_KEYS[pageMode] || pageMode)}
          </h2>
          <p>
            {pageMode === "Login History"
              ? translate(language, "historyDescription")
              : pageMode === "Settings"
                ? translate(language, "settingsDescription")
                : translate(language, "profileDescription")}
          </p>
        </div>
        <div className="profile-header-actions">
          {pageMode === "Settings" && (
            <button className="profile-secondary-button" type="button" onClick={() => onNavigate("Profile")}>
              <ArrowLeft size={15} /> {translate(language, "backToProfile")}
            </button>
          )}
          <button className="profile-signout-button" type="button" onClick={onLogout}>{translate(language, "signOut")}</button>
        </div>
      </div>
      <div className={`profile-grid ${pageMode === "Login History" ? "profile-history-grid" : ""}`}>
        {pageMode === "Profile" && (
        <section className="panel profile-card" aria-labelledby="profile-details-title">
          <div className="profile-card-heading">
            {profilePhoto ? (
              <button
                className={`avatar profile-photo profile-photo-preview-button ${isPhotoHoldActive ? "holding" : ""}`}
                type="button"
                aria-label="Press and hold for 1 second to view the original profile picture"
                onPointerDown={startPhotoViewHold}
                onPointerUp={cancelPhotoViewHold}
                onPointerCancel={cancelPhotoViewHold}
                onPointerLeave={cancelPhotoViewHold}
                onKeyDown={(event) => {
                  if (event.key === " " || event.key === "Enter") {
                    event.preventDefault();
                    startPhotoViewHold();
                  }
                }}
                onKeyUp={cancelPhotoViewHold}
                onBlur={cancelPhotoViewHold}
                onContextMenu={(event) => event.preventDefault()}
              >
                <img src={profilePhoto} alt="" style={{ transform: `scale(${profilePhotoZoom})` }} />
              </button>
            ) : (
              <div className="avatar profile-photo">
                {greetingName === "there" ? "U" : greetingName.charAt(0).toUpperCase()}
              </div>
            )}
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
            <p className="profile-settings-note">
              Press and hold the picture for 1 second to view the original.
            </p>
          )}
          {isPhotoHoldActive && (
            <p className="profile-settings-note" role="status">Keep holding to view the original picture...</p>
          )}
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
        )}
        {pageMode === "Profile" && (
        <div className="profile-settings-column profile-shortcuts-column">
          <section className="panel profile-card profile-shortcuts-card" aria-labelledby="profile-shortcuts-title">
            <div className="profile-card-heading">
              <div className="settings-card-icon"><UserRound size={19} /></div>
              <div>
                <h3 id="profile-shortcuts-title">Account &amp; security</h3>
                <p>Quick access to your account activity and preferences.</p>
              </div>
            </div>
            <button className="profile-link-card" type="button" onClick={() => onNavigate("Login History")}>
              <span className="settings-card-icon"><History size={19} /></span>
              <span><strong>Login history</strong><small>Review recent account sign-ins</small></span>
              <ArrowUpRight size={17} />
            </button>
            <button className="profile-link-card" type="button" onClick={() => onNavigate("Settings")}>
              <span className="settings-card-icon"><Settings size={19} /></span>
              <span><strong>Settings</strong><small>Manage password and alerts</small></span>
              <ArrowUpRight size={17} />
            </button>
          </section>
          <section className="panel profile-card profile-danger-card" aria-labelledby="delete-account-title">
            <div className="profile-card-heading">
              <div className="settings-card-icon profile-danger-icon"><Trash2 size={19} /></div>
              <div>
                <h3 id="delete-account-title">Delete FinSight account</h3>
                <p>Permanently delete this account and its financial data.</p>
              </div>
            </div>
            <p className="profile-settings-note">
              This removes your profile, transactions, finance accounts, budgets, and login history. It cannot be undone.
            </p>
            <button
              className="profile-delete-button"
              type="button"
              onClick={() => {
                setDeleteAccountError("");
                setIsDeleteConfirmOpen(true);
              }}
            >
              Delete my account
            </button>
          </section>
        </div>
        )}
        {pageMode === "Settings" && (
        <div className="profile-settings-column">
          <section className="panel profile-card" aria-labelledby="appearance-settings-title">
            <div className="profile-card-heading">
              <div className="settings-card-icon"><Sparkles size={19} /></div>
              <div>
                <h3 id="appearance-settings-title">{translate(language, "appearance")}</h3>
                <p>{translate(language, "appearanceDescription")}</p>
              </div>
            </div>
            <label className="transaction-field" htmlFor="app-theme">
              {translate(language, "theme")}
              <select
                id="app-theme"
                value={appPreferences.theme}
                onChange={(event) => onAppPreferenceChange("theme", event.target.value)}
              >
                <option value="dark">{translate(language, "dark")}</option>
                <option value="light">{translate(language, "light")}</option>
                <option value="gray">{translate(language, "gray")}</option>
              </select>
            </label>
            <label className="transaction-field" htmlFor="app-language">
              {translate(language, "language")}
              <select id="app-language" value={language} onChange={(event) => onLanguageChange(event.target.value)}>
                {LANGUAGES.map((item) => <option value={item.code} key={item.code}>{item.name}</option>)}
              </select>
              <small>{translate(language, "chooseLanguage")}</small>
            </label>
            <div className="dashboard-color-setting">
              <strong>{translate(language, "dashboardColor")}</strong>
              <span>{translate(language, "colorDescription")}</span>
              <div className="dashboard-color-options" role="group" aria-label="Dashboard color">
                {DASHBOARD_COLORS.map((color) => (
                  <button
                    className={`dashboard-color-swatch${dashboardColorDraft === color.value ? " selected" : ""}`}
                    type="button"
                    key={color.value}
                    style={{ "--swatch-color": color.value }}
                    aria-label={`Select ${color.name} dashboard color`}
                    aria-pressed={dashboardColorDraft === color.value}
                    onClick={() => setDashboardColorDraft(color.value)}
                  />
                ))}
              </div>
              <button
                className="profile-secondary-button"
                type="button"
                disabled={dashboardColorDraft === appPreferences.dashboardColor}
                onClick={() => setPendingDashboardColor(dashboardColorDraft)}
              >
                {translate(language, "applyColor")}
              </button>
              <button
                className="profile-secondary-button"
                type="button"
                disabled={dashboardColorDraft === DASHBOARD_COLORS[0].value && appPreferences.dashboardColor === DASHBOARD_COLORS[0].value}
                onClick={() => {
                  setDashboardColorDraft(DASHBOARD_COLORS[0].value);
                  onAppPreferenceChange("dashboardColor", DASHBOARD_COLORS[0].value);
                }}
              >
                {translate(language, "resetColor")}
              </button>
            </div>
            <label className="profile-setting">
              <span className="profile-setting-copy">
                <strong>{translate(language, "animations")}</strong>
                <small>Turn dashboard and interface motion on or off.</small>
              </span>
              <input
                type="checkbox"
                aria-label="Animations"
                checked={appPreferences.animationsEnabled}
                onChange={(event) => onAppPreferenceChange("animationsEnabled", event.target.checked)}
              />
            </label>
            <p className="profile-settings-note">Appearance preferences are saved in this browser for this signed-in account.</p>
          </section>
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
          <section className="panel profile-card profile-shortcuts-card">
            <h3>Account activity</h3>
            <button className="profile-link-card" type="button" onClick={() => onNavigate("Login History")}>
              <span className="settings-card-icon"><History size={19} /></span>
              <span><strong>Login history</strong><small>Review recent account sign-ins</small></span>
              <ArrowUpRight size={17} />
            </button>
          </section>
        </div>
        )}
        {pageMode === "Login History" && (
        <section className="panel profile-card">
          <div className="profile-card-heading">
            <div className="settings-card-icon"><History size={19} /></div>
            <div>
              <h3 id="login-history-title">Login history</h3>
              <p>Recent successful sign-ins and sign-outs for this account.</p>
            </div>
          </div>
          {isLoadingHistory ? (
            <p className="profile-settings-note" role="status">Loading login history...</p>
          ) : historyError ? (
            <p className="profile-form-error" role="alert">{historyError}</p>
          ) : loginHistory.length ? (
            <ol className="login-history-list">
              {loginHistory.map((entry, index) => (
                <li key={`${entry.eventType}-${entry.occurredAt}-${index}`}>
                  <strong>{entry.eventType === "LOGIN" ? "Signed in" : "Signed out"}</strong>
                  <time dateTime={entry.occurredAt}>
                    {new Date(entry.occurredAt).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </time>
                </li>
              ))}
            </ol>
          ) : (
            <p className="profile-settings-note">No sign-in history is available yet.</p>
          )}
          <div className="profile-edit-actions">
            <button className="profile-secondary-button" type="button" onClick={() => onNavigate("Profile")}>
              Back to profile
            </button>
            <button className="add-button" type="button" onClick={() => onNavigate("Settings")}>
              Settings <ArrowUpRight size={16} />
            </button>
          </div>
        </section>
        )}
      </div>
    </section>
    {pendingDashboardColor && (
      <div className="transaction-modal-backdrop">
        <section
          className="transaction-modal panel"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-dashboard-color-title"
        >
          <div className="transaction-modal-header">
            <div>
              <h2 id="confirm-dashboard-color-title">Apply this dashboard color?</h2>
              <p>Your dashboard accent will change to the selected color.</p>
            </div>
          </div>
          <div className="transaction-form-actions">
            <button className="profile-secondary-button" type="button" onClick={() => setPendingDashboardColor("")}>
              Cancel
            </button>
            <button
              className="add-button"
              type="button"
              onClick={() => {
                onAppPreferenceChange("dashboardColor", pendingDashboardColor);
                setPendingDashboardColor("");
              }}
            >
              Confirm color
            </button>
          </div>
        </section>
      </div>
    )}
    {isDeleteConfirmOpen && (
      <div className="transaction-modal-backdrop">
        <section
          className="transaction-modal panel account-delete-modal"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-account-delete-title"
          aria-describedby="confirm-account-delete-description"
        >
          <div className="transaction-modal-header">
            <div>
              <h2 id="confirm-account-delete-title">Delete your FinSight account?</h2>
              <p id="confirm-account-delete-description">
                Your profile and all financial records and sign-in history will be permanently deleted.
              </p>
            </div>
          </div>
          {deleteAccountError && <p className="profile-form-error" role="alert">{deleteAccountError}</p>}
          <div className="transaction-form-actions">
            <button
              className="profile-secondary-button"
              type="button"
              onClick={() => setIsDeleteConfirmOpen(false)}
              disabled={isDeletingAccount}
            >
              Cancel
            </button>
            <button
              className="profile-delete-button"
              type="button"
              onClick={handleDeleteAccount}
              disabled={isDeletingAccount}
            >
              {isDeletingAccount ? "Deleting account..." : "Permanently delete"}
            </button>
          </div>
        </section>
      </div>
    )}
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
    { name: "AI Assistant", aliases: ["assistant", "finance assistant", "financial assistant"] },
    { name: "Profile", aliases: ["user", "account", "account profile"] },
    { name: "Settings", aliases: ["settings", "preferences", "account settings"] },
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

function LandingPage({ onLogin, language, onLanguageChange }) {
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

  const scrollToSection = (sectionId) => {
    document.getElementById(sectionId)?.scrollIntoView?.({ behavior: "smooth" });
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
          <a href="#product-tour">{translate(language, "landingTour")}</a>
          <a href="#about">{translate(language, "landingAbout")}</a>
        </nav>
        <label className="landing-language-control">
          <span>{translate(language, "language")}</span>
          <select aria-label={translate(language, "language")} value={language} onChange={(event) => onLanguageChange(event.target.value)}>
            {LANGUAGES.map((item) => <option value={item.code} key={item.code}>{item.name}</option>)}
          </select>
        </label>
        <span className="landing-header-hint">PULL THE LAMP THREAD TO BEGIN</span>
      </header>

      <main>
        <section className="landing-hero" id="home">
          <div className="landing-hero-copy">
            <div className="landing-eyebrow"><span /> YOUR MONEY, IN A BETTER LIGHT</div>
            <h1>{translate(language, "welcome")}</h1>
            <p className="landing-lede">
              {translate(language, "landingDescription")}
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
            <h2>{translate(language, "landingFeatures")}</h2>
          </div>
          <div className="landing-feature-grid">
            <article className="landing-feature">
              <span className="landing-feature-icon feature-purple"><ChartNoAxesCombined size={21} /></span>
              <h3>{translate(language, "feature1Title")}</h3>
              <p>{translate(language, "feature1Description")}</p>
            </article>
            <article className="landing-feature">
              <span className="landing-feature-icon feature-green"><Wallet size={21} /></span>
              <h3>{translate(language, "feature2Title")}</h3>
              <p>{translate(language, "feature2Description")}</p>
            </article>
            <article className="landing-feature">
              <span className="landing-feature-icon feature-orange"><Sparkles size={21} /></span>
              <h3>{translate(language, "feature3Title")}</h3>
              <p>{translate(language, "feature3Description")}</p>
            </article>
          </div>
        </section>

        <section className="landing-product-tour" id="product-tour">
          <div className="landing-section-heading">
            <span>A CLEARER VIEW OF YOUR MONEY</span>
            <h2>{translate(language, "landingTour")}</h2>
            <p>{translate(language, "landingTourDescription")}</p>
          </div>
          <div className="landing-gallery-grid">
            <article className="landing-gallery-card">
              <div className="gallery-balance-preview">
                <span className="gallery-preview-kicker">MONTHLY BALANCE RATIO · SAMPLE</span>
                <strong>₹48,250</strong>
                <div className="gallery-ratio-track"><span /></div>
                <div className="gallery-ratio-labels"><span>Income ₹62,000</span><span>78% retained</span></div>
              </div>
              <h3>{translate(language, "monthlyBalance")}</h3>
              <p>{translate(language, "monthlyBalanceDescription")}</p>
            </article>
            <article className="landing-gallery-card">
              <div className="gallery-cashflow-preview">
                <span className="gallery-preview-kicker">CASH FLOW · SAMPLE</span>
                <div className="gallery-chart-bars" aria-hidden="true">
                  {[48, 70, 54, 84, 62, 92, 73].map((height, index) => (
                    <span key={index} style={{ "--bar-height": `${height}%` }} />
                  ))}
                </div>
                <div className="gallery-ratio-labels"><span>Income</span><span>Expenses</span></div>
              </div>
              <h3>{translate(language, "incomeExpenses")}</h3>
              <p>{translate(language, "incomeExpensesDescription")}</p>
            </article>
            <article className="landing-gallery-card">
              <div className="gallery-category-preview">
                <span className="gallery-preview-kicker">SPENDING MIX · SAMPLE</span>
                <div className="gallery-donut" aria-label="Illustrative spending category chart">
                  <span>₹18,400</span>
                </div>
                <div className="gallery-category-labels"><span>Home</span><span>Food</span><span>Travel</span></div>
              </div>
              <h3>{translate(language, "spendingCategories")}</h3>
              <p>{translate(language, "categoriesDescription")}</p>
            </article>
            <article className="landing-gallery-card">
              <div className="gallery-transactions-preview">
                <span className="gallery-preview-kicker">RECENT ACTIVITY · SAMPLE</span>
                <div className="gallery-transaction-row"><i className="gallery-income-dot" /><span>Monthly income</span><strong>+₹32,000</strong></div>
                <div className="gallery-transaction-row"><i className="gallery-expense-dot" /><span>Everyday expense</span><strong>−₹1,250</strong></div>
                <div className="gallery-transaction-row"><i className="gallery-high-dot" /><span>Large purchase</span><strong>−₹12,400</strong></div>
              </div>
              <h3>{translate(language, "transactionHistory")}</h3>
              <p>{translate(language, "transactionsDescription")}</p>
            </article>
            <article className="landing-gallery-card">
              <div className="gallery-budget-preview">
                <span className="gallery-preview-kicker">BUDGET PROGRESS · SAMPLE</span>
                <div><span>Food</span><strong>72%</strong><i><b style={{ width: "72%" }} /></i></div>
                <div><span>Travel</span><strong>44%</strong><i><b style={{ width: "44%" }} /></i></div>
                <div><span>Home</span><strong>88%</strong><i><b style={{ width: "88%" }} /></i></div>
              </div>
              <h3>{translate(language, "budgetsGoals")}</h3>
              <p>{translate(language, "budgetsDescription")}</p>
            </article>
          </div>
        </section>

        <section className="landing-about" id="about">
          <span>ABOUT FINSIGHT</span>
          <h2>{translate(language, "landingAbout")}</h2>
          <p>{translate(language, "aboutDescription")}</p>
          <button className="landing-tour-cta" type="button" onClick={() => scrollToSection("product-tour")}>
            Explore the previews <ArrowUpRight size={16} />
          </button>
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

function ProfileSetupView({ userInfo, onComplete, onSignOut, logoutError }) {
  const [formData, setFormData] = useState({
    displayName: userInfo.name || "",
    email: userInfo.email || "",
    age: "",
    gender: "",
    mobileNumber: userInfo.phone || "",
    address: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError("");

    getApiJson("/api/auth/profile")
      .then((profile) => {
        if (
          !profile
          || typeof profile !== "object"
          || Array.isArray(profile)
          || !Object.prototype.hasOwnProperty.call(profile, "age")
          || !Object.prototype.hasOwnProperty.call(profile, "gender")
        ) {
          throw new Error("The server returned invalid profile details.");
        }
        if (profile.age !== null && profile.age !== undefined && String(profile.gender || "").trim()) {
          onComplete(profile);
          return;
        }
        if (!active) return;
        setFormData({
          displayName: profile.displayName || userInfo.name || "",
          email: profile.email || userInfo.email || "",
          age: profile.age === null || profile.age === undefined ? "" : String(profile.age),
          gender: profile.gender || "",
          mobileNumber: profile.mobileNumber || userInfo.phone || "",
          address: profile.address || "",
        });
        setProfileLoaded(true);
        setIsLoading(false);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError.message);
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [loadAttempt, onComplete, userInfo]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          displayName: formData.displayName.trim(),
          age: Number(formData.age),
          gender: formData.gender.trim(),
          mobileNumber: formData.mobileNumber.trim(),
          address: formData.address.trim(),
        }),
      });
      const profile = await parseApiResponse(response);
      if (
        !profile
        || typeof profile !== "object"
        || Array.isArray(profile)
        || profile.age === null
        || profile.age === undefined
        || !String(profile.gender || "").trim()
      ) {
        throw new Error("The server returned invalid profile details.");
      }
      onComplete(profile);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="profile-setup-page">
      <section className="profile-setup-card panel" aria-labelledby="profile-setup-title">
        <div className="profile-setup-heading">
          <div className="profile-setup-icon"><UserRound size={22} /></div>
          <div>
            <p className="profile-setup-eyebrow">FINANCE PROFILE</p>
            <h1 id="profile-setup-title">Complete your profile</h1>
            <p>Tell us a little about yourself before opening your dashboard.</p>
          </div>
        </div>
        {isLoading ? (
          <p className="profile-setup-status" role="status">Loading your profile details...</p>
        ) : !profileLoaded ? (
          <div className="profile-setup-error-block">
            <p className="profile-form-error" role="alert">{error}</p>
            <button type="button" className="profile-secondary-button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>
              Try again
            </button>
          </div>
        ) : (
          <form className="profile-setup-form" onSubmit={handleSubmit}>
            <label className="profile-setup-field">
              <span>Name</span>
              <input name="displayName" type="text" autoComplete="name" value={formData.displayName} onChange={handleChange} required maxLength={80} />
            </label>
            <div className="profile-setup-field">
              <label htmlFor="profile-setup-email">Email</label>
              <input
                id="profile-setup-email"
                name="email"
                type="email"
                autoComplete="email"
                value={formData.email}
                placeholder="No email address on this account"
                readOnly
              />
              <small>Your sign-in email is managed by your account.</small>
            </div>
            <div className="profile-setup-row">
              <label className="profile-setup-field">
                <span>Age</span>
                <input name="age" type="number" min="1" max="120" value={formData.age} onChange={handleChange} required />
              </label>
              <label className="profile-setup-field">
                <span>Gender</span>
                <input
                  name="gender"
                  type="text"
                  list="profile-gender-options"
                  value={formData.gender}
                  onChange={handleChange}
                  required
                  maxLength={40}
                />
                <datalist id="profile-gender-options">
                  <option value="Female" />
                  <option value="Male" />
                  <option value="Non-binary" />
                  <option value="Prefer not to say" />
                  <option value="Other" />
                </datalist>
              </label>
            </div>
            <label className="profile-setup-field">
              <span>Mobile number <small>(optional)</small></span>
              <input name="mobileNumber" type="tel" autoComplete="tel" value={formData.mobileNumber} onChange={handleChange} maxLength={30} />
            </label>
            <label className="profile-setup-field">
              <span>Address <small>(optional)</small></span>
              <textarea name="address" autoComplete="street-address" value={formData.address} onChange={handleChange} maxLength={500} rows={3} />
            </label>
            {error && <p className="profile-form-error" role="alert">{error}</p>}
            <button className="profile-setup-submit" type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Submit"}
            </button>
          </form>
        )}
        {logoutError && <p className="profile-form-error" role="alert">{logoutError}</p>}
        {!isLoading && (
          <button className="profile-setup-signout" type="button" onClick={onSignOut} disabled={isSaving}>
            Sign out
          </button>
        )}
      </section>
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

  return transactions.map((transaction) => {
    const isHighExpense = transaction.type === "expense" && Number(transaction.amount) >= HIGH_EXPENSE_AMOUNT;
    const transactionColor = transaction.type === "income"
      ? "transaction-green"
      : isHighExpense ? "transaction-pink" : "transaction-blue";
    return (
    <div
      className={`transaction-row ${transactionColor}`}
      key={transaction.id}
      title={isHighExpense ? "High expense · ₹10,000 or more" : undefined}
    >
      <div className="transaction-icon">
        <Wallet size={19} />
      </div>
      <div className="transaction-details">
        <strong>{transaction.description}</strong>
        <span>{transaction.category}</span>
      </div>
      <span className="transaction-date">
        {dateFormatter.format(new Date(`${transaction.transactionDate}T00:00:00`))}
      </span>
      <strong className={`transaction-amount ${transaction.type}${isHighExpense ? " expense-high" : ""}`}>
        {transaction.type === "expense" ? "−" : "+"}
        {CURRENCY_FORMATTER.format(Number(transaction.amount))}
      </strong>
    </div>
    );
  });
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

async function downloadBudgetPdf(budgets, periodType) {
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
  const { jsPDF } = await import("jspdf");
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

async function downloadTransactionPdf(transactions, periodType, selectedDate) {
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

  const { jsPDF } = await import("jspdf");
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
                <React.Suspense fallback={<div className="chart-loading-placeholder" aria-hidden="true" />}>
                  <CashFlowChart
                    data={analytics.monthly}
                    gradientId="analytics"
                    currencyFormatter={(value) => CURRENCY_FORMATTER.format(value)}
                    yAxisFormatter={compactCurrency}
                    yAxisWidth={55}
                    tooltipContentStyle={{ background: "#202438", border: "1px solid #363b54", borderRadius: 8 }}
                    tooltipLabelFormatter={(label) => `Month: ${label}`}
                    strokeWidth={2}
                  />
                </React.Suspense>
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
                <React.Suspense fallback={<div className="chart-loading-placeholder" aria-hidden="true" />}>
                  <SpendingCategoryChart
                    data={analytics.categories}
                    innerRadius={56}
                    outerRadius={78}
                    paddingAngle={3}
                    tooltipContentStyle={{ background: "#202438", border: "1px solid #363b54", borderRadius: 8 }}
                    currencyFormatter={(value) => CURRENCY_FORMATTER.format(value)}
                  />
                </React.Suspense>
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
            Starting balance (INR)
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
  const [language, setLanguage] = useState(() => {
    const savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return LANGUAGES.some((item) => item.code === savedLanguage) ? savedLanguage : "en";
  });
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
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [userInfo, setUserInfo] = useState({ email: "", phone: "", name: "" });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchError, setSearchError] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [transactionError, setTransactionError] = useState("");
  const [isTransactionFormOpen, setIsTransactionFormOpen] = useState(false);
  const [isResetTransactionsConfirmOpen, setIsResetTransactionsConfirmOpen] = useState(false);
  const [isResettingTransactions, setIsResettingTransactions] = useState(false);
  const [resetTransactionsError, setResetTransactionsError] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [accountError, setAccountError] = useState("");
  const [isAccountFormOpen, setIsAccountFormOpen] = useState(false);
  const [budgets, setBudgets] = useState([]);
  const [budgetError, setBudgetError] = useState("");
  const [isBudgetFormOpen, setIsBudgetFormOpen] = useState(false);
  const [budgetPdfPeriod, setBudgetPdfPeriod] = useState("WEEKLY");
  const [budgetPdfError, setBudgetPdfError] = useState("");
  const [dashboardPeriod, setDashboardPeriod] = useState("MONTHLY");
  const [dashboardPeriodDate, setDashboardPeriodDate] = useState(dateKey(new Date()));
  const [transactionPdfPeriod, setTransactionPdfPeriod] = useState("DAILY");
  const [transactionPdfDate, setTransactionPdfDate] = useState(dateKey(new Date()));
  const [transactionPdfError, setTransactionPdfError] = useState("");
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [selectedNotificationId, setSelectedNotificationId] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [notificationStoreOwner, setNotificationStoreOwner] = useState("");
  const [notificationStorageError, setNotificationStorageError] = useState("");
  const [alertPreferences, setAlertPreferences] = useState({
    highExpenseAlerts: true,
    lowCashFlowAlerts: true,
    notificationSound: false,
  });
  const preferenceStorageKey = `finsight-alerts:${(userInfo.email || userInfo.phone || "personal").trim().toLocaleLowerCase()}`;
  const accountStorageKey = (userInfo.email || userInfo.phone || "personal").trim().toLocaleLowerCase();
  const appPreferenceStorageKey = `finsight-appearance:${accountStorageKey}`;
  const notificationStorageKey = `finsight-notifications:${accountStorageKey}`;
  const profilePhotoStorageKey = `finsight-profile-photo:${accountStorageKey}`;
  const profilePhotoZoomStorageKey = `finsight-profile-photo-zoom:${accountStorageKey}`;
  const [profilePhoto, setProfilePhoto] = useState("");
  const [profilePhotoZoom, setProfilePhotoZoom] = useState(1);
  const [isProfilePhotoOpen, setIsProfilePhotoOpen] = useState(false);
  const [appPreferences, setAppPreferences] = useState({
    theme: "dark",
    dashboardColor: DASHBOARD_COLORS[0].value,
    animationsEnabled: true,
  });
  const notificationAudioRef = useRef(null);
  const loginWelcomePendingRef = useRef(false);
  const loginIsNewAccountRef = useRef(false);
  const previousAlertIdsRef = useRef(new Set());
  const previousNotificationAlertIdsRef = useRef(new Set());

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    if (!isProfilePhotoOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setIsProfilePhotoOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isProfilePhotoOpen]);

  useEffect(() => {
    setAlertPreferences({
      highExpenseAlerts: window.localStorage.getItem(`${preferenceStorageKey}:highExpenseAlerts`) !== "false",
      lowCashFlowAlerts: window.localStorage.getItem(`${preferenceStorageKey}:lowCashFlowAlerts`) !== "false",
      notificationSound: window.localStorage.getItem(`${preferenceStorageKey}:notificationSound`) === "true",
    });
  }, [preferenceStorageKey]);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(`${appPreferenceStorageKey}:theme`);
    const savedDashboardColor = window.localStorage.getItem(`${appPreferenceStorageKey}:dashboardColor`);
    const savedAnimations = window.localStorage.getItem(`${appPreferenceStorageKey}:animationsEnabled`);
    setAppPreferences({
      theme: APP_THEMES.includes(savedTheme) ? savedTheme : "dark",
      dashboardColor: DASHBOARD_COLORS.some((color) => color.value === savedDashboardColor)
        ? savedDashboardColor
        : DASHBOARD_COLORS[0].value,
      animationsEnabled: savedAnimations !== "false",
    });
  }, [appPreferenceStorageKey]);

  useEffect(() => {
    try {
      setNotifications(readStoredNotifications(notificationStorageKey));
      setNotificationStoreOwner(notificationStorageKey);
      setNotificationStorageError("");
    } catch (error) {
      setNotifications([]);
      setNotificationStoreOwner("");
      setNotificationStorageError(error.message);
    }
    previousNotificationAlertIdsRef.current = new Set();
  }, [notificationStorageKey]);

  useEffect(() => {
    if (notificationStoreOwner !== notificationStorageKey) return;
    try {
      window.localStorage.setItem(notificationStorageKey, JSON.stringify(notifications));
      setNotificationStorageError("");
    } catch {
      setNotificationStorageError("Notification changes could not be saved in this browser.");
    }
  }, [notificationStorageKey, notificationStoreOwner, notifications]);

  useEffect(() => {
    if (
      currentPage !== "dashboard"
      || notificationStoreOwner !== notificationStorageKey
      || !loginWelcomePendingRef.current
    ) {
      return;
    }
    loginWelcomePendingRef.current = false;
    const createdAt = Date.now();
    const isNewAccount = loginIsNewAccountRef.current;
    loginIsNewAccountRef.current = false;
    setNotifications((current) => [{
      id: `login-success-${createdAt}`,
      sourceId: "login-success",
      title: translate(language, isNewAccount ? "accountCreatedTitle" : "loginTitle"),
      message: translate(language, isNewAccount ? "accountCreatedMessage" : "loginMessage"),
      tone: "positive",
      createdAt: new Date(createdAt).toISOString(),
      read: false,
      dismissed: false,
    }, ...current].slice(0, 100));
  }, [currentPage, language, notificationStorageKey, notificationStoreOwner]);

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
        const isOAuthCallback = url.searchParams.has("oauth");
        if (isOAuthCallback) {
          url.searchParams.delete("oauth");
          window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
        }
        const response = await fetch(`${API_BASE_URL}/api/auth/session`, { credentials: "include" });
        const result = await parseApiResponse(response);
        if (!active) return;
        if (result.authenticated) {
          if (isOAuthCallback) loginWelcomePendingRef.current = true;
          window.localStorage.setItem(AUTH_STORAGE_KEY, "true");
          setUserInfo({
            email: result.email || "",
            phone: result.phone || "",
            name: result.displayName || "",
          });
          setCurrentPage("profile-setup");
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

  const handleLogin = (user = {}) => {
    loginWelcomePendingRef.current = true;
    loginIsNewAccountRef.current = user.isNewAccount === true;
    window.localStorage.setItem(AUTH_STORAGE_KEY, "true");
    setUserInfo({
      email: user.email || "",
      phone: user.phone || "",
      name: user.name || "",
    });
    setCurrentPage("profile-setup");
  };

  const handleTransactionCreated = (transaction) => {
    setTransactionError("");
    setTransactions((current) => [transaction, ...current].sort((left, right) => (
      right.transactionDate.localeCompare(left.transactionDate) || right.id - left.id
    )));
    const amount = Number(transaction.amount);
    const netChange = transaction.type === "income" ? amount : -amount;
    const remainingBalance = currentNetCashBalance + (transaction.transactionDate <= todayDate ? netChange : 0);
    const createdAt = Date.now();
    setNotifications((current) => [{
      id: `transaction-${transaction.id}`,
      sourceId: `transaction-${transaction.id}`,
      title: `${transaction.type === "income" ? "Income" : "Expense"} recorded`,
      message: `${transaction.description}: ${transaction.type === "income" ? "+" : "−"}${CURRENCY_FORMATTER.format(amount)} for ${transaction.category}. Remaining net cash balance: ${CURRENCY_FORMATTER.format(remainingBalance)}.`,
      tone: transaction.type === "income" ? "positive" : "neutral",
      createdAt: new Date(createdAt).toISOString(),
      read: false,
      dismissed: false,
    }, ...current].slice(0, 100));
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

  const handleBudgetPdfDownload = async () => {
    setBudgetPdfError("");
    try {
      if (!await downloadBudgetPdf(budgets, budgetPdfPeriod)) {
        setBudgetPdfError(`No ${budgetPdfPeriod === "BIMONTHLY" ? "two-month" : budgetPdfPeriod.toLowerCase()} budgets to download yet.`);
      }
    } catch (error) {
      setBudgetPdfError(error instanceof Error ? error.message : "The budget PDF could not be generated.");
    }
  };

  const handleTransactionPdfDownload = async () => {
    setTransactionPdfError("");
    try {
      if (!await downloadTransactionPdf(transactions, transactionPdfPeriod, transactionPdfDate)) {
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

  const handleAppPreferenceChange = (preference, value) => {
    window.localStorage.setItem(`${appPreferenceStorageKey}:${preference}`, String(value));
    setAppPreferences((current) => ({ ...current, [preference]: value }));
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

  const handleProfileSetupComplete = useCallback((profile) => {
    handleProfileUpdated(profile);
    setCurrentPage("dashboard");
  }, [handleProfileUpdated]);

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
      setSearchError("No matching page found. Try Dashboard, Transactions, Accounts, Analytics, Budgets, AI Insights, AI Assistant, Profile, or Settings.");
      return;
    }
    navigateToPage(page);
    setSearchQuery("");
  };

  const handleLogout = async () => {
    setLogoutError("");
    setIsLoggingOut(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/logout`, { method: "POST", credentials: "include" });
      await parseApiResponse(response);
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
      setIsLogoutConfirmOpen(false);
      setActivePage("Dashboard");
      setMenuOpen(false);
      setCurrentPage("landing");
    } catch (error) {
      setLogoutError(error.message);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleResetTransactions = async () => {
    setResetTransactionsError("");
    setIsResettingTransactions(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/transactions`, {
        method: "DELETE",
        credentials: "include",
      });
      const result = await parseApiResponse(response);
      if (!result.deleted) throw new Error("The transactions could not be reset.");
      setTransactions([]);
      setTransactionError("");
      setNotifications((current) => current.filter((notification) => (
        !notification.sourceId.startsWith("transaction-")
        && notification.sourceId !== "high-expenses"
        && notification.sourceId !== "low-cash-flow"
        && !notification.sourceId.startsWith("budget-")
      )));
      setIsResetTransactionsConfirmOpen(false);
    } catch (error) {
      setResetTransactionsError(error.message);
    } finally {
      setIsResettingTransactions(false);
    }
  };

  const handleDeleteAccount = async () => {
    const response = await fetch(`${API_BASE_URL}/api/auth/account`, {
      method: "DELETE",
      credentials: "include",
    });
    await parseApiResponse(response);

    let browserDataCleanupFailed = false;
    try {
      [
        AUTH_STORAGE_KEY,
        `${preferenceStorageKey}:highExpenseAlerts`,
        `${preferenceStorageKey}:lowCashFlowAlerts`,
        `${preferenceStorageKey}:notificationSound`,
        `${appPreferenceStorageKey}:theme`,
        `${appPreferenceStorageKey}:dashboardColor`,
        `${appPreferenceStorageKey}:animationsEnabled`,
        profilePhotoStorageKey,
        profilePhotoZoomStorageKey,
        notificationStorageKey,
      ].forEach((key) => window.localStorage.removeItem(key));
    } catch (error) {
      if (!(error instanceof DOMException)) throw error;
      browserDataCleanupFailed = true;
    }

    setTransactions([]);
    setAccounts([]);
    setBudgets([]);
    setNotifications([]);
    setUserInfo({ email: "", phone: "", name: "" });
    setIsNotificationsOpen(false);
    setActivePage("Dashboard");
    setCurrentPage("landing");
    if (browserDataCleanupFailed) {
      setLogoutError("Your account was deleted, but some browser-only preferences could not be cleared.");
    }
  };

  const dashboardAnalytics = getAnalyticsData(transactions);
  const currentMonthSummary = useMemo(
    () => getCurrentMonthSummary(transactions, budgets),
    [transactions, budgets]
  );
  const financialAlerts = useMemo(
    () => getFinancialAlerts(currentMonthSummary, alertPreferences),
    [currentMonthSummary, alertPreferences]
  );
  const activeAlertIds = useMemo(
    () => new Set(financialAlerts.map((alert) => alert.id)),
    [financialAlerts]
  );
  const activeAlertSignature = financialAlerts.map((alert) => alert.id).join("|");
  const currentNotifications = notificationStoreOwner === notificationStorageKey ? notifications : [];
  const visibleNotifications = currentNotifications.filter((notification) => !notification.dismissed);
  const unreadNotificationCount = visibleNotifications.filter((notification) => !notification.read).length;
  const selectedNotification = visibleNotifications.find((notification) => notification.id === selectedNotificationId);
  const toggleNotifications = () => {
    const opening = !isNotificationsOpen;
    if (opening) setSelectedNotificationId("");
    setIsNotificationsOpen(opening);
  };
  const openNotification = (notificationId) => {
    setSelectedNotificationId(notificationId);
    setNotifications((current) => current.map((notification) => (
      notification.id === notificationId ? { ...notification, read: true } : notification
    )));
  };
  const deleteNotification = (notificationId) => {
    setNotifications((current) => current.flatMap((notification) => {
      if (notification.id !== notificationId) return [notification];
      if (activeAlertIds.has(notification.sourceId)) {
        return [{ ...notification, read: true, dismissed: true }];
      }
      return [];
    }));
  };
  const transactionPdfRange = getTransactionReportRange(transactionPdfPeriod, transactionPdfDate);
  const transactionPdfCount = transactions.filter((transaction) => (
    transaction.transactionDate >= transactionPdfRange.start && transaction.transactionDate <= transactionPdfRange.end
  )).length;
  const budgetPdfCount = budgets.filter((budget) => (
    (budget.periodType || "MONTHLY").toUpperCase() === budgetPdfPeriod
  )).length;
  const accountBalance = accounts.reduce((total, account) => total + Number(account.balance || 0), 0);
  const dashboardPeriodRange = getDashboardPeriodRange(dashboardPeriod, dashboardPeriodDate);
  const dashboardPeriodTransactions = transactions.filter((transaction) => (
    transaction.transactionDate >= dashboardPeriodRange.start
    && transaction.transactionDate <= dashboardPeriodRange.end
  ));
  const periodIncome = dashboardPeriodTransactions
    .filter((transaction) => transaction.type === "income")
    .reduce((total, transaction) => total + Number(transaction.amount || 0), 0);
  const periodExpenses = dashboardPeriodTransactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((total, transaction) => total + Number(transaction.amount || 0), 0);
  const todayDate = dateKey(new Date());
  const balanceCutoff = dashboardPeriodRange.end < todayDate ? dashboardPeriodRange.end : todayDate;
  const netActivityThrough = (cutoff) => transactions
    .filter((transaction) => transaction.transactionDate <= cutoff)
    .reduce((net, transaction) => (
      net + (transaction.type === "income" ? Number(transaction.amount || 0) : -Number(transaction.amount || 0))
    ), 0);
  const currentNetCashBalance = accountBalance + netActivityThrough(todayDate);
  const periodBalance = accountBalance + netActivityThrough(balanceCutoff);
  const dashboardPeriodName = {
    WEEKLY: "Weekly",
    MONTHLY: "Monthly",
    YEARLY: "Yearly",
  }[dashboardPeriod];
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
      title: `${dashboardPeriodName} Total Balance`,
      value: CURRENCY_FORMATTER.format(periodBalance),
      description: accounts.length === 0 && transactions.length === 0
        ? "Add an account to set your starting balance"
        : dashboardPeriodRange.end < todayDate
          ? `Estimated period-end · ${dashboardPeriodRange.label}`
          : `Balance after saved activity · ${dashboardPeriodRange.label}`,
      icon: Wallet,
      className: "balance-card",
    },
    {
      title: `${dashboardPeriodName} Total Income`,
      value: CURRENCY_FORMATTER.format(periodIncome),
      description: `For ${dashboardPeriodRange.label}`,
      icon: TrendingUp,
      className: "income-card",
    },
    {
      title: `${dashboardPeriodName} Total Expenses`,
      value: CURRENCY_FORMATTER.format(periodExpenses),
      description: `For ${dashboardPeriodRange.label}`,
      icon: TrendingDown,
      className: "expense-card",
    },
    {
      title: `${dashboardPeriodName} Net Cash Flow`,
      value: CURRENCY_FORMATTER.format(periodIncome - periodExpenses),
      description: `Income minus expenses · ${dashboardPeriodRange.label}`,
      icon: Target,
      className: "savings-card",
    },
  ];

  useEffect(() => {
    if (notificationStoreOwner !== notificationStorageKey) return;
    setNotifications((current) => {
      const retained = current.filter((notification) => (
        !notification.dismissed || activeAlertIds.has(notification.sourceId)
      ));
      return retained.length === current.length ? current : retained;
    });
  }, [activeAlertIds, activeAlertSignature, notificationStorageKey, notificationStoreOwner]);

  useEffect(() => {
    if (currentPage !== "dashboard" || notificationStoreOwner !== notificationStorageKey) return;
    const newAlerts = financialAlerts.filter(
      (alert) => !previousNotificationAlertIdsRef.current.has(alert.id)
    );
    previousNotificationAlertIdsRef.current = activeAlertIds;
    if (!newAlerts.length) return;

    const createdAt = Date.now();
    setNotifications((current) => [
      ...newAlerts.map((alert, index) => ({
        id: `${alert.id}-${createdAt + index}`,
        sourceId: alert.id,
        title: alert.title,
        message: alert.message,
        tone: alert.tone,
        createdAt: new Date(createdAt + index).toISOString(),
        read: false,
        dismissed: false,
      })),
      ...current,
    ].slice(0, 100));
  }, [activeAlertIds, activeAlertSignature, currentPage, financialAlerts, notificationStorageKey, notificationStoreOwner]);

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
    return (
      <LandingPage
        language={language}
        onLanguageChange={setLanguage}
        onLogin={() => setCurrentPage("login")}
      />
    );
  }

  if (currentPage === "login") {
    return (
      <Login
        onLogin={handleLogin}
        onBackToLanding={() => setCurrentPage("landing")}
      />
    );
  }

  const assistantAccent = getComplementaryColor(appPreferences.dashboardColor);
  const appColorVariables = {
    "--dashboard-accent": appPreferences.dashboardColor,
    "--dashboard-foreground": getContrastingTextColor(appPreferences.dashboardColor),
    "--assistant-accent": assistantAccent,
    "--assistant-foreground": getContrastingTextColor(assistantAccent),
  };

  if (currentPage === "profile-setup") {
    return (
      <div
        className={`app-shell theme-${appPreferences.theme}${appPreferences.animationsEnabled ? "" : " animations-off"}`}
        style={appColorVariables}
      >
        <ProfileSetupView
          userInfo={userInfo}
          onComplete={handleProfileSetupComplete}
          onSignOut={handleLogout}
          logoutError={logoutError}
        />
      </div>
    );
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
    <div
      className={`app-shell theme-${appPreferences.theme}${appPreferences.animationsEnabled ? "" : " animations-off"}`}
      style={appColorVariables}
    >

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
                <span>{translate(language, PAGE_TRANSLATION_KEYS[item.name] || item.name)}</span>
                {item.name === "AI Assistant" && (
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
            className={`nav-item settings-button ${activePage === "Settings" ? "active" : ""}`}
            type="button"
            onClick={() => navigateToPage("Settings")}
          >
            <Settings size={19} />
            <span>{translate(language, "settings")}</span>
          </button>

          <div className="profile">
            <button
              className="profile-trigger"
              type="button"
              aria-label={`Open profile for ${greetingName}`}
              onClick={() => navigateToPage("Profile")}
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
              onClick={() => setIsLogoutConfirmOpen(true)}
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
            <h1>{translate(language, PAGE_TRANSLATION_KEYS[activePage] || activePage)}</h1>
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
                <span>{translate(language, "dashboard")}</span>
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
                aria-label={`Notifications${unreadNotificationCount ? `, ${unreadNotificationCount} alerts` : ""}`}
                aria-expanded={isNotificationsOpen}
                aria-controls="financial-notifications"
                onClick={toggleNotifications}
              >
                <Bell size={19} />
                {unreadNotificationCount > 0 && (
                  <span className="notification-count">{unreadNotificationCount}</span>
                )}
              </button>
              {isNotificationsOpen && (
                <section className="notification-popover" id="financial-notifications" aria-label="Financial notifications">
                  <div className="notification-popover-header">
                    <div>
                      <strong>Notifications</strong>
                      <span>
                        {visibleNotifications.length
                          ? unreadNotificationCount
                            ? `${unreadNotificationCount} unread · ${visibleNotifications.length} saved`
                            : `${visibleNotifications.length} saved`
                          : "You're all caught up"}
                      </span>
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
                  {notificationStorageError ? (
                    <p className="notification-empty" role="alert">{notificationStorageError}</p>
                  ) : transactionError || budgetError ? (
                    <p className="notification-empty" role="alert">
                      Alerts may be incomplete: {transactionError || budgetError}
                    </p>
                  ) : selectedNotification ? (
                    <div className="notification-detail">
                      <button
                        className="notification-back"
                        type="button"
                        onClick={() => setSelectedNotificationId("")}
                      >
                        <ArrowLeft size={14} /> Back to notifications
                      </button>
                      <article className={`notification-item notification-${selectedNotification.tone}`}>
                        <span className="notification-item-icon"><Bell size={15} /></span>
                        <div className="notification-item-copy">
                          <strong>{selectedNotification.title}</strong>
                          <p>{selectedNotification.message}</p>
                          <time dateTime={selectedNotification.createdAt}>
                            {new Date(selectedNotification.createdAt).toLocaleString("en-IN", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </time>
                        </div>
                        <button
                          className="notification-delete"
                          type="button"
                          aria-label={`Delete ${selectedNotification.title} notification`}
                          onClick={() => deleteNotification(selectedNotification.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </article>
                    </div>
                  ) : visibleNotifications.length > 0 ? (
                    <div className="notification-list">
                      {visibleNotifications.map((notification) => (
                        <article
                          className={`notification-item notification-${notification.tone}${notification.read ? "" : " notification-unread"}`}
                          key={notification.id}
                        >
                          <button
                            className="notification-item-open"
                            type="button"
                            aria-label={`Open notification: ${notification.title}`}
                            onClick={() => openNotification(notification.id)}
                          >
                            <span className="notification-item-icon"><Bell size={15} /></span>
                            <span className="notification-item-copy">
                              <strong>
                                {notification.title}
                                {!notification.read && <span className="notification-unread-indicator" aria-label="Unread" />}
                              </strong>
                              <span className="notification-item-message">{notification.message}</span>
                              <time dateTime={notification.createdAt}>
                                {new Date(notification.createdAt).toLocaleString("en-IN", {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                })}
                              </time>
                            </span>
                          </button>
                          <button
                            className="notification-delete"
                            type="button"
                            aria-label={`Delete ${notification.title} notification`}
                            onClick={() => deleteNotification(notification.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="notification-empty">No saved financial notifications right now.</p>
                  )}
                  <button
                    className="notification-settings-link"
                    type="button"
                    onClick={() => navigateToPage("Settings")}
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
                <h2>{translate(language, "dashboardGreeting", { name: greetingName })}</h2>
                <p className="welcome-subtitle">
                  {hasFinancialData
                    ? translate(language, "welcomeToday")
                    : translate(language, "welcomeEmpty")}
                </p>
              </div>

              <button className="add-button" type="button" onClick={() => setIsTransactionFormOpen(true)}>
                <Plus size={18} /> {translate(language, "addTransaction")}
              </button>
            </section>
            <section className="dashboard-period-bar" aria-label="Dashboard reporting period">
              <div>
                <strong>{translate(language, "financialOverview")}</strong>
                <span>{translate(language, "periodPrompt")}</span>
              </div>
              <div className="dashboard-period-controls">
                <label htmlFor="dashboard-period">{translate(language, "period")}</label>
                <select
                  id="dashboard-period"
                  value={dashboardPeriod}
                  onChange={(event) => setDashboardPeriod(event.target.value)}
                >
                  <option value="WEEKLY">{translate(language, "weekly")}</option>
                  <option value="MONTHLY">{translate(language, "monthly")}</option>
                  <option value="YEARLY">{translate(language, "yearly")}</option>
                </select>
                <label className="visually-hidden" htmlFor="dashboard-period-date">
                  {dashboardPeriod === "WEEKLY" ? "Week containing" : dashboardPeriod === "MONTHLY" ? "Month" : "Year"}
                </label>
                <input
                  id="dashboard-period-date"
                  aria-label={dashboardPeriod === "WEEKLY" ? "Week containing" : dashboardPeriod === "MONTHLY" ? "Month" : "Year"}
                  type={dashboardPeriod === "WEEKLY" ? "date" : dashboardPeriod === "MONTHLY" ? "month" : "number"}
                  min={dashboardPeriod === "YEARLY" ? "1970" : undefined}
                  max={dashboardPeriod === "YEARLY" ? String(new Date().getFullYear() + 1) : undefined}
                  value={dashboardPeriod === "WEEKLY"
                    ? dashboardPeriodDate
                    : dashboardPeriod === "MONTHLY"
                      ? dashboardPeriodDate.slice(0, 7)
                      : dashboardPeriodDate.slice(0, 4)}
                  onChange={(event) => setDashboardPeriodDate(
                    dashboardPeriod === "WEEKLY"
                      ? event.target.value
                      : dashboardPeriod === "MONTHLY"
                        ? `${event.target.value}-01`
                        : `${event.target.value}-01-01`
                  )}
                />
              </div>
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
                  <div
                    key={stat.title}
                    className={`stat-card ${stat.className}${appPreferences.animationsEnabled ? " stat-card-animated" : ""}`}
                    style={{ "--stat-card-animation-delay": `${index * 0.1}s` }}
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
                    {stat.className === "balance-card" && accounts.length === 0 && (
                      <button
                        className="stat-action"
                        type="button"
                        onClick={() => setIsAccountFormOpen(true)}
                      >
                        Add starting balance
                      </button>
                    )}
                  </div>
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
                      <React.Suspense fallback={<div className="chart-loading-placeholder" aria-hidden="true" />}>
                        <CashFlowChart
                          data={dashboardAnalytics.monthly}
                          gradientId="dashboard"
                          currencyFormatter={(value) => CURRENCY_FORMATTER.format(value)}
                          yAxisFormatter={(value) => CURRENCY_FORMATTER.format(value)}
                          yAxisWidth={82}
                          tooltipContentStyle={{
                            background: "#202438",
                            border: "1px solid #363b54",
                            borderRadius: "12px",
                            color: "#fff",
                          }}
                          strokeWidth={3}
                        />
                      </React.Suspense>
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
                      <React.Suspense fallback={<div className="chart-loading-placeholder" aria-hidden="true" />}>
                        <SpendingCategoryChart
                          data={dashboardAnalytics.categories}
                          innerRadius={65}
                          outerRadius={90}
                          paddingAngle={5}
                          tooltipContentStyle={{
                            background: "#202438",
                            border: "1px solid #363b54",
                            borderRadius: "10px",
                            color: "#fff",
                          }}
                          currencyFormatter={(value) => CURRENCY_FORMATTER.format(value)}
                        />
                      </React.Suspense>
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
                  <button className="profile-secondary-button" type="button" onClick={() => navigateToPage("Transactions")}>
                    All transactions <ArrowUpRight size={15} />
                  </button>
                </div>

                {transactionError && <p className="transaction-form-error" role="alert">{transactionError}</p>}
                <div className="transaction-list">
                  <TransactionList transactions={transactions.slice(0, 5)} />
                </div>
              </div>

              {/* AI INSIGHT */}
              <div className={`panel ai-panel${appPreferences.animationsEnabled ? " ai-panel-animated" : ""}`}>
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
                  onClick={() => navigateToPage("AI Insights")}
                >
                  Explore AI Insights <ArrowUpRight size={17} />
                </button>
              </div>
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
                <button
                  className="profile-delete-button"
                  type="button"
                  onClick={() => {
                    setResetTransactionsError("");
                    setIsResetTransactionsConfirmOpen(true);
                  }}
                  disabled={transactions.length === 0}
                >
                  Reset transactions
                </button>
              </div>
            </div>
            {transactionError && <p className="transaction-form-error" role="alert">{transactionError}</p>}
            {transactionPdfError && <p className="transaction-form-error" role="alert">{transactionPdfError}</p>}
            {resetTransactionsError && <p className="transaction-form-error" role="alert">{resetTransactionsError}</p>}
            <div className="transaction-list">
              <TransactionList transactions={transactions} />
            </div>
          </section>
        ) : activePage === "Accounts" ? (
          <section className="transactions-page panel">
            <div className="transactions-page-header">
              <div>
                <h2>Your accounts</h2>
                <p>Track account balances and starting amounts in Indian rupees.</p>
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
            onViewTransactions={() => navigateToPage("Transactions")}
          />
        ) : activePage === "AI Assistant" ? (
          <AiAssistantView
            language={language}
            context={{
              rangeLabel: dashboardPeriodRange.label,
              transactions: dashboardPeriodTransactions,
              income: periodIncome,
              expenses: periodExpenses,
              balance: currentNetCashBalance,
              budgets,
            }}
          />
        ) : activePage === "Profile" ? (
          <ProfileView
            pageMode="Profile"
            userInfo={userInfo}
            greetingName={greetingName}
            language={language}
            onLanguageChange={setLanguage}
            preferences={alertPreferences}
            appPreferences={appPreferences}
            profilePhoto={profilePhoto}
            profilePhotoZoom={profilePhotoZoom}
            onProfilePhotoView={() => setIsProfilePhotoOpen(true)}
            onPreferenceChange={handleAlertPreferenceChange}
            onAppPreferenceChange={handleAppPreferenceChange}
            onProfileUpdated={handleProfileUpdated}
            onProfilePhotoChange={handleProfilePhotoChange}
            onProfilePhotoZoomChange={handleProfilePhotoZoomChange}
            onLogout={() => setIsLogoutConfirmOpen(true)}
            onDeleteAccount={handleDeleteAccount}
            onNavigate={navigateToPage}
          />
        ) : activePage === "Settings" || activePage === "Login History" ? (
          <ProfileView
            pageMode={activePage}
            userInfo={userInfo}
            greetingName={greetingName}
            language={language}
            onLanguageChange={setLanguage}
            preferences={alertPreferences}
            appPreferences={appPreferences}
            profilePhoto={profilePhoto}
            profilePhotoZoom={profilePhotoZoom}
            onProfilePhotoView={() => setIsProfilePhotoOpen(true)}
            onPreferenceChange={handleAlertPreferenceChange}
            onAppPreferenceChange={handleAppPreferenceChange}
            onProfileUpdated={handleProfileUpdated}
            onProfilePhotoChange={handleProfilePhotoChange}
            onProfilePhotoZoomChange={handleProfilePhotoZoomChange}
            onLogout={() => setIsLogoutConfirmOpen(true)}
            onDeleteAccount={handleDeleteAccount}
            onNavigate={navigateToPage}
          />
        ) : (
          <section className="coming-soon panel">
            <div className="coming-icon"><Sparkles size={32} /></div>
            <h2>{activePage}</h2>
            <p>This section is ready for the next development milestone.</p>
            <button className="add-button" type="button" onClick={() => navigateToPage("Dashboard")}>
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
      {isLogoutConfirmOpen && (
        <div className="transaction-modal-backdrop">
          <section
            className="transaction-modal panel"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-signout-title"
          >
            <div className="transaction-modal-header">
              <div>
                <h2 id="confirm-signout-title">Sign out of FinSight?</h2>
                <p>Are you sure you want to end your current session?</p>
              </div>
            </div>
            {logoutError && <p className="profile-form-error" role="alert">{logoutError}</p>}
            <div className="transaction-form-actions">
              <button
                className="profile-secondary-button"
                type="button"
                onClick={() => setIsLogoutConfirmOpen(false)}
                disabled={isLoggingOut}
              >
                Cancel
              </button>
              <button className="profile-delete-button" type="button" onClick={handleLogout} disabled={isLoggingOut}>
                {isLoggingOut ? "Signing out..." : "Confirm sign out"}
              </button>
            </div>
          </section>
        </div>
      )}
      {isResetTransactionsConfirmOpen && (
        <div className="transaction-modal-backdrop">
          <section
            className="transaction-modal panel"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-reset-transactions-title"
          >
            <div className="transaction-modal-header">
              <div>
                <h2 id="confirm-reset-transactions-title">Reset all transactions?</h2>
                <p>This permanently removes your saved transactions. Your accounts and budgets will remain.</p>
              </div>
            </div>
            {resetTransactionsError && <p className="profile-form-error" role="alert">{resetTransactionsError}</p>}
            <div className="transaction-form-actions">
              <button
                className="profile-secondary-button"
                type="button"
                onClick={() => setIsResetTransactionsConfirmOpen(false)}
                disabled={isResettingTransactions}
              >
                Cancel
              </button>
              <button
                className="profile-delete-button"
                type="button"
                onClick={handleResetTransactions}
                disabled={isResettingTransactions}
              >
                {isResettingTransactions ? "Resetting..." : "Reset transactions"}
              </button>
            </div>
          </section>
        </div>
      )}
      {isProfilePhotoOpen && profilePhoto && (
        <div
          className="profile-photo-viewer-backdrop"
          onClick={() => setIsProfilePhotoOpen(false)}
        >
          <section
            className="profile-photo-viewer panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-photo-viewer-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="profile-photo-viewer-header">
              <h2 id="profile-photo-viewer-title">Profile picture</h2>
              <button
                className="transaction-modal-close"
                type="button"
                aria-label="Close profile picture"
                autoFocus
                onClick={() => setIsProfilePhotoOpen(false)}
              >
                <X size={19} />
              </button>
            </div>
            <img className="profile-photo-original" src={profilePhoto} alt={`Portrait of ${greetingName}`} />
          </section>
        </div>
      )}
    </div>
  );
}

export default App;