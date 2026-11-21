import React, { useEffect, useRef, useState } from "react";
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
import "./App.css";

const weeklyData = [
  { day: "Mon", income: 4200, expense: 1800 },
  { day: "Tue", income: 5200, expense: 2800 },
  { day: "Wed", income: 3800, expense: 2200 },
  { day: "Thu", income: 6500, expense: 3100 },
  { day: "Fri", income: 4800, expense: 2600 },
  { day: "Sat", income: 7200, expense: 3900 },
  { day: "Sun", income: 5800, expense: 2400 },
];

const categoryData = [
  { name: "Food", value: 35, color: "#9b7bff" },
  { name: "Shopping", value: 25, color: "#38d9b2" },
  { name: "Transport", value: 20, color: "#ffb86b" },
  { name: "Bills", value: 20, color: "#5e9cff" },
];

const navigation = [
  { name: "Dashboard", icon: LayoutDashboard },
  { name: "Transactions", icon: ArrowLeftRight },
  { name: "Accounts", icon: Wallet },
  { name: "Analytics", icon: ChartNoAxesCombined },
  { name: "Budgets", icon: Target },
  { name: "AI Insights", icon: Sparkles },
];

const AUTH_STORAGE_KEY = "finsight-authenticated";
const API_BASE_URL = process.env.REACT_APP_API_URL || "";

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
            <p className="landing-note">PULL THE LAMP THREAD TO SIGN IN</p>
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
              caption="PULL THE LAMP THREAD TO SIGN IN"
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

function App() {
  const [currentPage, setCurrentPage] = useState(() =>
    window.localStorage.getItem(AUTH_STORAGE_KEY) === "true" ? "session-check" : "landing"
  );
  const [activePage, setActivePage] = useState("Dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [logoutError, setLogoutError] = useState("");

  useEffect(() => {
    if (currentPage !== "session-check") return undefined;
    let active = true;
    const checkSession = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/session`, { credentials: "include" });
        const result = await parseApiResponse(response);
        if (!active) return;
        if (result.authenticated) {
          setCurrentPage("dashboard");
        } else {
          window.localStorage.removeItem(AUTH_STORAGE_KEY);
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
    if (currentPage !== "loading") return undefined;
    const loadingTimer = window.setTimeout(() => setCurrentPage("dashboard"), 1600);
    return () => window.clearTimeout(loadingTimer);
  }, [currentPage]);

  const handleLogin = () => {
    window.localStorage.setItem(AUTH_STORAGE_KEY, "true");
    setCurrentPage("loading");
  };

  const handleLogout = () => {
    setLogoutError("");
    fetch(`${API_BASE_URL}/api/auth/logout`, { method: "POST", credentials: "include" })
      .then(parseApiResponse)
      .then(() => {
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
        setActivePage("Dashboard");
        setMenuOpen(false);
        setCurrentPage("landing");
      })
      .catch((error) => setLogoutError(error.message));
  };

  const stats = [
    {
      title: "Total Balance",
      value: "â‚¹1,24,500",
      change: "+12.8%",
      description: "Compared to last month",
      icon: Wallet,
      className: "balance-card",
      trend: "up",
    },
    {
      title: "Total Income",
      value: "â‚¹65,000",
      change: "+8.4%",
      description: "Compared to last month",
      icon: TrendingUp,
      className: "income-card",
      trend: "up",
    },
    {
      title: "Total Expenses",
      value: "â‚¹28,450",
      change: "-4.2%",
      description: "Compared to last month",
      icon: TrendingDown,
      className: "expense-card",
      trend: "down",
    },
    {
      title: "Total Savings",
      value: "â‚¹36,550",
      change: "+15.6%",
      description: "Compared to last month",
      icon: Target,
      className: "savings-card",
      trend: "up",
    },
  ];

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
                onClick={() => {
                  setActivePage(item.name);
                  setMenuOpen(false);
                }}
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
            <button onClick={() => setActivePage("AI Insights")}>
              Explore AI <ArrowUpRight size={15} />
            </button>
          </div>

          <button className="nav-item settings-button">
            <Settings size={19} />
            <span>Settings</span>
          </button>

          <div className="profile">
            <div className="avatar">A</div>
            <div className="profile-info">
              <strong>Alex Morgan</strong>
              <span>Premium Member</span>
            </div>
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

        {/* TOP NAVBAR */}
        <header className="topbar">
          <div className="page-heading">
            <span className="breadcrumb">Workspace /</span>
            <h1>{activePage}</h1>
          </div>

          <div className="top-actions">
            <div className="search-box">
              <Search size={17} />
              <input placeholder="Search anything..." />
              <span>âŒ˜ K</span>
            </div>

            <button className="notification-button" aria-label="Notifications">
              <Bell size={19} />
              <span className="notification-dot"></span>
            </button>

            <div className="top-avatar">A</div>
          </div>
        </header>

        {/* DASHBOARD */}
        {activePage === "Dashboard" ? (
          <>
            <section className="welcome-section">
              <div>
                <p className="welcome-date">
                  <CalendarDays size={15} /> Saturday, November 21, 2026
                </p>
                <h2>Welcome back, Alex <span>âœ¦</span></h2>
                <p className="welcome-subtitle">
                  Here's what's happening with your money today.
                </p>
              </div>

              <button className="add-button">
                <Plus size={18} /> Add Transaction
              </button>
            </section>

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
                      <span className="stat-change">
                        {stat.change}
                      </span>
                    </div>
                    <p className="stat-title">{stat.title}</p>
                    <h2>{stat.value}</h2>
                    <p className="stat-description">
                      {stat.description}
                    </p>
                  </motion.div>
                );
              })}
            </section>

            {/* CHARTS */}
            <section className="charts-grid">
              <div className="panel spending-panel">
                <div className="panel-header">
                  <div>
                    <h3>Financial Overview</h3>
                    <p>Track your income and expenses</p>
                  </div>
                  <button className="period-button">
                    This Week <span>âŒ„</span>
                  </button>
                </div>

                <div className="chart-legend">
                  <span><i className="legend-income"></i> Income</span>
                  <span><i className="legend-expense"></i> Expenses</span>
                </div>

                <div className="area-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={weeklyData}>
                      <defs>
                        <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#9b7bff" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#9b7bff" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#38d9b2" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#38d9b2" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#292d40" strokeDasharray="4 5" vertical={false} />
                      <XAxis dataKey="day" stroke="#777d94" tickLine={false} axisLine={false} />
                      <YAxis
                        stroke="#777d94"
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `â‚¹${value / 1000}k`}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#202438",
                          border: "1px solid #363b54",
                          borderRadius: "12px",
                          color: "#fff",
                        }}
                        formatter={(value) => `â‚¹${value.toLocaleString("en-IN")}`}
                      />
                      <Area
                        type="monotone"
                        dataKey="income"
                        stroke="#a78bfa"
                        strokeWidth={3}
                        fill="url(#incomeGradient)"
                      />
                      <Area
                        type="monotone"
                        dataKey="expense"
                        stroke="#38d9b2"
                        strokeWidth={3}
                        fill="url(#expenseGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* CATEGORY CHART */}
              <div className="panel category-panel">
                <div className="panel-header">
                  <div>
                    <h3>Spending Categories</h3>
                    <p>Where your money goes</p>
                  </div>
                  <button className="more-button">â€¢â€¢â€¢</button>
                </div>

                <div className="donut-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={65}
                        outerRadius={90}
                        paddingAngle={5}
                        stroke="none"
                      >
                        {categoryData.map((item) => (
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
                        formatter={(value) => `${value}%`}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="donut-center">
                    <span>Total Spent</span>
                    <strong>â‚¹28,450</strong>
                  </div>
                </div>

                <div className="category-legend">
                  {categoryData.map((item) => (
                    <div className="category-row" key={item.name}>
                      <span>
                        <i style={{ background: item.color }}></i>
                        {item.name}
                      </span>
                      <strong>{item.value}%</strong>
                    </div>
                  ))}
                </div>
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

                <div className="transaction-list">
                  <p className="transaction-empty">No transactions yet.</p>
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
                  <span className="live-badge">â— LIVE</span>
                </div>

                <h3>Your money has a story.<br />Let's understand it.</h3>
                <p>
                  Your food expenses are taking a bigger share of your
                  budget this month. A small change in weekend spending
                  could improve your savings.
                </p>

                <div className="ai-tip">
                  <div className="tip-icon"><TrendingUp size={19} /></div>
                  <div>
                    <strong>Smart saving tip</strong>
                    <span>Try reducing unnecessary orders to save more.</span>
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
              <span>Â© 2026 FinSight. Smart money, smarter future.</span>
              <span>Made with âœ¦ for your financial wellness</span>
            </footer>
          </>
        ) : (
          <section className="coming-soon panel">
            <div className="coming-icon"><Sparkles size={32} /></div>
            <h2>{activePage}</h2>
            <p>This section is ready for the next development milestone.</p>
            <button className="add-button" onClick={() => setActivePage("Dashboard")}>
              Back to Dashboard
            </button>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;