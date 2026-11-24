// Covers the React application UI, API interactions, and profile workflows.
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from './App';
import { API_BASE_URL } from './apiBaseUrl';
import { jsPDF } from 'jspdf';

const mockPdfSave = jest.fn();
const mockPdfText = jest.fn();
const completedProfile = (email = '') => ({
  displayName: '',
  email,
  age: 30,
  gender: 'Prefer not to say',
  mobileNumber: '',
  address: '',
});

jest.mock('jspdf', () => ({ jsPDF: jest.fn() }));
jest.mock('./Login', () => ({
  __esModule: true,
  default: function MockLogin({ onLogin }) {
    return (
      <>
        <button type="button" onClick={() => onLogin({ name: 'Fresh User', email: 'fresh@example.com' })}>Complete sign in</button>
        <button type="button" onClick={() => onLogin({ name: 'Fresh User', email: 'fresh@example.com', isNewAccount: true })}>Complete registration</button>
      </>
    );
  },
  PullLamp: function MockPullLamp({ onPull, caption }) {
    return (
      <>
        <button type="button" onClick={onPull}>Pull the cord</button>
        <p>{caption}</p>
      </>
    );
  },
}));

const originalFetch = global.fetch;

beforeEach(() => {
  jsPDF.mockClear();
  jsPDF.mockImplementation(function mockDocument() {
    this.addPage = jest.fn();
    this.save = mockPdfSave;
    this.setFont = jest.fn();
    this.setFontSize = jest.fn();
    this.text = mockPdfText;
  });
  mockPdfSave.mockClear();
  mockPdfText.mockClear();
  window.localStorage.clear();
  global.fetch = jest.fn((url) => Promise.resolve({
    ok: true,
    json: () => Promise.resolve(url.endsWith('/api/auth/session')
      ? { authenticated: true, email: 'person@example.com' }
      : url.endsWith('/api/auth/profile')
        ? {
          displayName: '',
          age: 30,
          gender: 'Prefer not to say',
          mobileNumber: '',
          address: '',
        }
      : ['/api/transactions', '/api/accounts', '/api/budgets'].some((path) => url.endsWith(path))
        ? []
        : { loggedOut: true }),
  }));
});

afterEach(() => {
  jest.useRealTimers();
  window.localStorage.clear();
  global.fetch = originalFetch;
});

test('pulling the landing lamp opens login, then sign in loads and restores the dashboard session', async () => {
  jest.useFakeTimers();
  const app = render(<App />);

  expect(screen.getByRole('heading', { name: /welcome to finsight application/i })).toBeInTheDocument();
  expect(screen.getByText('PULL THE LAMP THREAD TO SIGN IN / SIGN OUT')).toBeInTheDocument();
  expect(screen.getByText('PULL THE LAMP THREAD TO BEGIN')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Pull the cord' }));

  act(() => {
    jest.advanceTimersByTime(500);
  });
  fireEvent.click(screen.getByRole('button', { name: 'Complete sign in' }));
  expect(window.localStorage.getItem('finsight-authenticated')).toBe('true');
  expect(await screen.findByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  expect(screen.getAllByText('₹0.00')).toHaveLength(4);
  expect(screen.getByRole('heading', { name: /welcome to finsight, fresh user/i })).toBeInTheDocument();
  expect(screen.getByText(/your dashboard is ready/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Notifications/ }));
  expect(screen.getByText('Your login was successful. Welcome to the FinSight application.')).toBeInTheDocument();
  expect(screen.getByText('No transactions yet.')).toBeInTheDocument();
  expect(screen.queryByText('Grocery Shopping')).not.toBeInTheDocument();

  app.unmount();
  render(<App />);
  await act(async () => {
    await Promise.resolve();
  });
  expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /welcome to finsight, person/i })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm sign out' }));
  await waitFor(() => expect(window.localStorage.getItem('finsight-authenticated')).toBeNull());
  expect(window.localStorage.getItem('finsight-authenticated')).toBeNull();
  expect(screen.getByRole('heading', { name: /welcome to finsight application/i })).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith(`${API_BASE_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' });
});

test('landing page omits the middle-page action buttons and keeps the product overview', () => {
  render(<App />);

  expect(screen.getByRole('heading', { name: /welcome to finsight application/i })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /see the whole picture/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'About FinSight' })).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /five ways finsight brings it together/i })).toBeInTheDocument();
  expect(screen.getByText('Monthly balance ratio')).toBeInTheDocument();
  expect(screen.getByText('Transaction history')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /your personal finance picture, in one place/i })).toBeInTheDocument();
});

test('landing language selection translates the hero and persists for the app', () => {
  render(<App />);

  fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), { target: { value: 'hi' } });

  expect(screen.getByRole('heading', { name: 'FinSight एप्लिकेशन में आपका स्वागत है।' })).toBeInTheDocument();
  expect(window.localStorage.getItem('finsight-language')).toBe('hi');
  expect(document.documentElement.lang).toBe('hi');
});

test('new account registration shows a welcome notification', async () => {
  jest.useFakeTimers();
  render(<App />);

  fireEvent.click(screen.getByRole('button', { name: 'Pull the cord' }));
  act(() => jest.advanceTimersByTime(500));
  fireEvent.click(screen.getByRole('button', { name: 'Complete registration' }));
  act(() => jest.advanceTimersByTime(1600));

  await screen.findByRole('button', { name: 'Sign out' });
  fireEvent.click(screen.getByRole('button', { name: /Notifications/ }));
  expect(await screen.findByText('FinSight account created successfully')).toBeInTheDocument();
  expect(screen.getByText(/wishing you clarity, confidence, and success/i)).toBeInTheDocument();
});

test('incomplete profiles must be submitted before the dashboard opens', async () => {
  jest.useFakeTimers();
  global.fetch.mockImplementation((url, options = {}) => {
    if (url.endsWith('/api/auth/profile') && options.method === 'PUT') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          ...JSON.parse(options.body),
          email: 'fresh@example.com',
        }),
      });
    }
    if (url.endsWith('/api/auth/profile')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          displayName: 'Fresh User',
          email: 'fresh@example.com',
          age: null,
          gender: null,
          mobileNumber: null,
          address: null,
        }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(
        url.endsWith('/api/auth/profile')
          ? completedProfile()
          : ['/api/transactions', '/api/accounts', '/api/budgets'].some((path) => url.endsWith(path))
          ? []
          : { loggedOut: true }
      ),
    });
  });

  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Pull the cord' }));
  act(() => jest.advanceTimersByTime(500));
  fireEvent.click(screen.getByRole('button', { name: 'Complete sign in' }));

  expect(await screen.findByRole('heading', { name: 'Complete your profile' })).toBeInTheDocument();
  await screen.findByLabelText('Age');
  expect(screen.getByLabelText('Email')).toHaveValue('fresh@example.com');
  expect(screen.getByLabelText('Email')).toHaveAttribute('readonly');
  expect(document.querySelectorAll('#profile-gender-options option')).toHaveLength(5);
  expect(screen.queryByRole('heading', { name: /welcome to finsight, fresh user/i })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Age'), { target: { value: '34' } });
  fireEvent.change(screen.getByLabelText('Gender'), { target: { value: 'Prefer not to say' } });
  fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

  expect(await screen.findByRole('heading', { name: /welcome to finsight, fresh user/i })).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith(`${API_BASE_URL}/api/auth/profile`, expect.objectContaining({
    method: 'PUT',
    credentials: 'include',
    body: JSON.stringify({
      displayName: 'Fresh User',
      age: 34,
      gender: 'Prefer not to say',
      mobileNumber: '',
      address: '',
    }),
  }));
});

test('AI assistant welcomes and answers purpose questions in the selected language', async () => {
  window.localStorage.setItem('finsight-language', 'hi');
  window.localStorage.setItem('finsight-authenticated', 'true');
  render(<App />);

  fireEvent.click(await screen.findByRole('button', { name: /एआई सहायक/ }));

  expect(await screen.findByRole('heading', { name: 'एआई सहायक', level: 2 })).toBeInTheDocument();
  expect(screen.getByText(/नमस्ते! मैं/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'इस एप्लिकेशन का उद्देश्य क्या है?' }));
  expect(screen.getByText(/FinSight आपकी आय, खर्च/)).toBeInTheDocument();
});

test('a saved login hint is cleared when the server has no valid session', async () => {
  window.localStorage.setItem('finsight-authenticated', 'true');
  global.fetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ authenticated: false }),
  });

  render(<App />);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(screen.getByRole('heading', { name: /welcome to finsight application/i })).toBeInTheDocument();
  expect(window.localStorage.getItem('finsight-authenticated')).toBeNull();
});

test('transaction form saves entered details and updates the recent list', async () => {
  const savedTransaction = {
    id: 4,
    description: 'Lunch',
    category: 'Food',
    amount: 12.5,
    type: 'expense',
  };
  global.fetch.mockImplementation((url, options = {}) => {
    if (url.endsWith('/api/transactions') && options.method === 'POST') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          ...savedTransaction,
          transactionDate: JSON.parse(options.body).transactionDate,
        }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(
        url.endsWith('/api/auth/profile')
          ? completedProfile()
          : ['/api/transactions', '/api/accounts', '/api/budgets'].some((path) => url.endsWith(path))
          ? []
          : { loggedOut: true }
      ),
    });
  });

  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Pull the cord' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Complete sign in' }));
  await screen.findByRole('button', { name: 'Sign out' }, { timeout: 3000 });

  fireEvent.click(screen.getByRole('button', { name: 'Add Transaction' }));
  const dialog = screen.getByRole('dialog', { name: 'Add transaction' });
  fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Lunch' } });
  fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '12.50' } });
  fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Food' } });
  const transactionDate = screen.getByLabelText('Date').value;
  fireEvent.click(screen.getByRole('button', { name: 'Save transaction' }));

  expect(await screen.findByText('Lunch')).toBeInTheDocument();
  expect(dialog).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Notifications/ }));
  expect(await screen.findByText(/your login was successful\. welcome to the finsight application/i)).toBeInTheDocument();
  expect(screen.getByText(/remaining net cash balance: [-−]₹12\.50/i)).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith(`${API_BASE_URL}/api/transactions`, expect.objectContaining({
    method: 'POST',
    credentials: 'include',
    body: JSON.stringify({
      description: 'Lunch',
      amount: 12.5,
      type: 'expense',
      category: 'Food',
      transactionDate,
    }),
  }));
});

test('transaction history colors income, regular expenses, and high expenses distinctly', async () => {
  const today = new Date().toISOString().slice(0, 10);
  const savedTransactions = [
    { id: 1, description: 'Salary', category: 'Income', amount: 30000, type: 'income', transactionDate: today },
    { id: 2, description: 'Groceries', category: 'Food', amount: 850, type: 'expense', transactionDate: today },
    { id: 3, description: 'Large expense', category: 'Travel', amount: 10000, type: 'expense', transactionDate: today },
  ];
  global.fetch.mockImplementation((url) => Promise.resolve({
    ok: true,
    json: () => Promise.resolve(
      url.endsWith('/api/auth/session')
        ? { authenticated: true, email: 'colors@example.com' }
        : url.endsWith('/api/auth/profile') ? completedProfile('colors@example.com')
        : url.endsWith('/api/transactions') ? savedTransactions : []
    ),
  }));
  window.localStorage.setItem('finsight-authenticated', 'true');

  render(<App />);
  await screen.findByText('Large expense');
  fireEvent.click(screen.getByRole('button', { name: 'Transactions', exact: true }));

  expect(screen.getByText('Salary').closest('.transaction-row')).toHaveClass('transaction-green');
  expect(screen.getByText('Groceries').closest('.transaction-row')).toHaveClass('transaction-blue');
  expect(screen.getByText('Large expense').closest('.transaction-row')).toHaveClass('transaction-pink');
});

test('adding a starting account balance updates the dashboard total', async () => {
  const account = { id: 8, name: 'Main account', type: 'checking', balance: 12345.67 };
  global.fetch.mockImplementation((url, options = {}) => {
    if (url.endsWith('/api/accounts') && options.method === 'POST') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(account) });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(
        url.endsWith('/api/auth/profile')
          ? completedProfile()
          : ['/api/transactions', '/api/accounts', '/api/budgets'].some((path) => url.endsWith(path))
          ? []
          : { loggedOut: true }
      ),
    });
  });

  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Pull the cord' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Complete sign in' }));
  await screen.findByRole('button', { name: 'Sign out' }, { timeout: 3000 });
  fireEvent.click(screen.getByRole('button', { name: 'Add starting balance' }));
  fireEvent.change(screen.getByLabelText('Account name'), { target: { value: 'Main account' } });
  fireEvent.change(screen.getByLabelText('Starting balance (INR)'), { target: { value: '12345.67' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save account' }));

  expect(await screen.findByText('₹12,345.67')).toBeInTheDocument();
  expect(screen.getByText(/Balance after saved activity/)).toBeInTheDocument();
});

test('dashboard totals filter by the selected month and year', async () => {
  const now = new Date();
  const currentDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15`;
  global.fetch.mockImplementation((url) => Promise.resolve({
    ok: true,
    json: () => Promise.resolve(
      url.endsWith('/api/auth/session')
        ? { authenticated: true, email: 'period@example.com' }
        : url.endsWith('/api/auth/profile')
          ? completedProfile('period@example.com')
        : url.endsWith('/api/transactions')
          ? [
            { id: 1, description: 'Current income', amount: 1200, type: 'income', transactionDate: currentDate },
            { id: 2, description: 'Current expense', amount: 400, type: 'expense', transactionDate: currentDate },
            { id: 3, description: 'Last year income', amount: 300, type: 'income', transactionDate: '2025-03-15' },
          ]
          : url.endsWith('/api/accounts')
            ? [{ id: 4, name: 'Everyday', balance: 2500 }]
            : []
    ),
  }));
  window.localStorage.setItem('finsight-authenticated', 'true');

  render(<App />);
  await screen.findByRole('heading', { name: /welcome to finsight, period/i });
  expect(await within(screen.getByText('Monthly Total Income').closest('.stat-card')).findByText('₹1,200.00')).toBeInTheDocument();
  expect(await within(screen.getByText('Monthly Total Expenses').closest('.stat-card')).findByText('₹400.00')).toBeInTheDocument();
  expect(await within(screen.getByText('Monthly Net Cash Flow').closest('.stat-card')).findByText('₹800.00')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Period'), { target: { value: 'WEEKLY' } });
  fireEvent.change(screen.getByLabelText('Week containing'), { target: { value: currentDate } });
  expect(await within(screen.getByText('Weekly Total Balance').closest('.stat-card')).findByText('₹3,600.00')).toBeInTheDocument();
  expect(await within(screen.getByText('Weekly Total Income').closest('.stat-card')).findByText('₹1,200.00')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Period'), { target: { value: 'YEARLY' } });
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Year' }), { target: { value: '2025' } });
  expect(await within(screen.getByText('Yearly Total Income').closest('.stat-card')).findByText('₹300.00')).toBeInTheDocument();
  expect(await within(screen.getByText('Yearly Total Expenses').closest('.stat-card')).findByText('₹0.00')).toBeInTheDocument();
  expect(await within(screen.getByText('Yearly Total Balance').closest('.stat-card')).findByText('₹2,800.00')).toBeInTheDocument();
  expect(screen.getByText(/Estimated period-end/)).toBeInTheDocument();
});

test('profile links open login history and the separate settings page', async () => {
  global.fetch.mockImplementation((url) => Promise.resolve({
    ok: true,
    json: () => Promise.resolve(
      url.endsWith('/api/auth/session')
        ? { authenticated: true, email: 'profile@example.com' }
        : url.endsWith('/api/auth/profile')
          ? { ...completedProfile('profile@example.com'), displayName: 'Profile User' }
          : url.endsWith('/api/auth/history')
            ? [{ eventType: 'LOGIN', occurredAt: '2026-11-23T12:00:00Z' }]
            : []
    ),
  }));
  window.localStorage.setItem('finsight-authenticated', 'true');

  render(<App />);
  await screen.findByRole('button', { name: 'Sign out' });
  fireEvent.click(screen.getByRole('button', { name: 'Open profile' }));
  fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }));
  expect(screen.getByRole('alertdialog', { name: 'Delete your FinSight account?' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  fireEvent.click(screen.getByRole('button', { name: /review recent account sign-ins/i }));
  expect(await screen.findByRole('heading', { name: 'Login History', level: 2 })).toBeInTheDocument();
  expect(await screen.findByText('Signed in')).toBeInTheDocument();

  fireEvent.click(within(screen.getByRole('complementary')).getByRole('button', { name: 'Settings' }));
  expect(await screen.findByRole('heading', { name: 'Settings', level: 2 })).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: /^Select .* dashboard color$/ })).toHaveLength(34);
  expect(screen.getByRole('checkbox', { name: 'High expense alerts' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Theme'), { target: { value: 'light' } });
  fireEvent.click(screen.getByRole('button', { name: 'Select Mint dashboard color' }));
  fireEvent.click(screen.getByRole('button', { name: 'Apply dashboard color' }));
  expect(screen.getByRole('alertdialog', { name: 'Apply this dashboard color?' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm color' }));
  expect(document.querySelector('.app-shell')).toHaveStyle({ '--assistant-accent': '#d9385f' });
  const animations = screen.getByRole('checkbox', { name: 'Animations' });
  fireEvent.click(animations);
  expect(document.querySelector('.app-shell')).toHaveClass('theme-light', 'animations-off');
  expect(window.localStorage.getItem('finsight-appearance:profile@example.com:theme')).toBe('light');
  expect(window.localStorage.getItem('finsight-appearance:profile@example.com:dashboardColor')).toBe('#38d9b2');
  fireEvent.click(screen.getByRole('button', { name: 'Reset to original color' }));
  expect(window.localStorage.getItem('finsight-appearance:profile@example.com:dashboardColor')).toBe('#9b7bff');
  expect(document.querySelector('.app-shell')).toHaveStyle({ '--dashboard-accent': '#9b7bff' });
  expect(document.querySelector('.app-shell')).toHaveStyle({ '--assistant-accent': '#dfff7b' });
  fireEvent.click(screen.getByRole('button', { name: 'Back to profile' }));
  expect(await screen.findByRole('heading', { name: 'Profile & settings' })).toBeInTheDocument();
});

test('accounts and budgets can be entered and persisted through the API', async () => {
  const account = { id: 2, name: 'Main savings', type: 'savings', balance: 1250 };
  const budget = { id: 3, category: 'Food', amount: 500, month: '2026-11' };
  global.fetch.mockImplementation((url, options = {}) => {
    if (url.endsWith('/api/accounts') && options.method === 'POST') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(account) });
    }
    if (url.endsWith('/api/budgets') && options.method === 'POST') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ ...budget, month: JSON.parse(options.body).month }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(
        url.endsWith('/api/auth/profile') ? completedProfile() : []
      ),
    });
  });

  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Pull the cord' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Complete sign in' }));
  await screen.findByRole('button', { name: 'Sign out' }, { timeout: 3000 });

  fireEvent.click(screen.getByRole('button', { name: 'Accounts' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add Account' }));
  fireEvent.change(screen.getByLabelText('Account name'), { target: { value: 'Main savings' } });
  fireEvent.change(screen.getByLabelText('Starting balance (INR)'), { target: { value: '1250' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save account' }));
  expect(await screen.findByText('Main savings')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Budgets' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add Budget' }));
  fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Food' } });
  fireEvent.change(screen.getByLabelText('Budget limit (INR)'), { target: { value: '500' } });
  const month = screen.getByLabelText('Month').value;
  fireEvent.click(screen.getByRole('button', { name: 'Save budget' }));
  expect(await screen.findByText('Food')).toBeInTheDocument();

  expect(global.fetch).toHaveBeenCalledWith(`${API_BASE_URL}/api/accounts`, expect.objectContaining({
    method: 'POST',
    body: JSON.stringify({ name: 'Main savings', type: 'checking', balance: 1250 }),
  }));
  expect(global.fetch).toHaveBeenCalledWith(`${API_BASE_URL}/api/budgets`, expect.objectContaining({
    method: 'POST',
    body: JSON.stringify({
      category: 'Food',
      amount: 500,
      month,
      periodType: 'MONTHLY',
      periodStart: `${month}-01`,
    }),
  }));
});

test('analytics summarizes saved transactions and shows category spending', async () => {
  const now = new Date();
  const transactionDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  global.fetch.mockImplementation((url) => Promise.resolve({
    ok: true,
    json: () => Promise.resolve(url.endsWith('/api/auth/profile') ? completedProfile() : url.endsWith('/api/transactions') ? [
      { id: 1, description: 'Salary', category: 'Work', amount: 2500, type: 'income', transactionDate },
      { id: 2, description: 'Groceries', category: 'Food', amount: 600, type: 'expense', transactionDate },
      { id: 3, description: 'Electricity', category: 'Bills', amount: 200, type: 'expense', transactionDate },
    ] : ['/api/accounts', '/api/budgets'].some((path) => url.endsWith(path))
      ? []
      : { authenticated: true, email: 'person@example.com' }),
  }));

  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Pull the cord' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Complete sign in' }));
  await screen.findByRole('button', { name: 'Sign out' }, { timeout: 3000 });
  fireEvent.click(screen.getByRole('button', { name: 'Analytics' }));

  expect(await screen.findByRole('heading', { name: 'Analytics overview' })).toBeInTheDocument();
  expect(screen.getByText('₹2,500.00')).toBeInTheDocument();
  expect(screen.getAllByText('₹800.00')).toHaveLength(2);
  expect(screen.getByText('₹1,700.00')).toBeInTheDocument();
  expect(screen.getByText('Food')).toBeInTheDocument();
  expect(screen.getByText('Bills')).toBeInTheDocument();
  expect(screen.getByText('75%')).toBeInTheDocument();
});

test('AI insights, alerts, profile settings, and Dashboard navigation use saved account data', async () => {
  const now = new Date();
  const transactionDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  global.fetch.mockImplementation((url) => Promise.resolve({
    ok: true,
    json: () => Promise.resolve(
      url.endsWith('/api/transactions') ? [
        { id: 1, description: 'Salary', category: 'Work', amount: 1000, type: 'income', transactionDate },
        { id: 2, description: 'Groceries', category: 'Food', amount: 900, type: 'expense', transactionDate },
      ] : url.endsWith('/api/budgets')
        ? [{ id: 3, category: 'Food', amount: 500, month: transactionDate.slice(0, 7) }]
        : url.endsWith('/api/accounts')
          ? []
          : url.endsWith('/api/auth/profile')
            ? completedProfile('fresh@example.com')
          : { authenticated: true, email: 'person@example.com' }
    ),
  }));

  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Pull the cord' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Complete sign in' }));
  await screen.findByRole('button', { name: 'Sign out' }, { timeout: 3000 });
  expect(screen.queryByRole('button', { name: 'Go back' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /^AI Insights/ }));

  expect(await screen.findByText('Cash-flow cushion is tight')).toBeInTheDocument();
  expect(screen.getByText('Food is your top spending category')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Go to Dashboard' }));
  expect(await screen.findByRole('heading', { name: /welcome to finsight, fresh user!/i })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /^AI Assistant/ }));
  expect(await screen.findByRole('heading', { name: 'AI Assistant', level: 2 })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'What was my top spending category?' }));
  expect(await screen.findByText(/Food is your top recorded spending category.*₹900\.00/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'What is the purpose of this application?' }));
  expect(await screen.findByText(/FinSight helps you organize income, expenses, account balances, and budgets/i)).toBeInTheDocument();
  expect(screen.getByText(/Answers use only your saved app data and stay in this app/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Go back' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Go to Dashboard' }));
  expect(await screen.findByRole('heading', { name: /welcome to finsight, fresh user!/i })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Notifications, 4 alerts' }));
  expect(screen.getByText('High expenses this month')).toBeInTheDocument();
  expect(screen.getByText('Food budget exceeded')).toBeInTheDocument();
  expect(screen.getByText('Low net cash flow')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Open profile' }));
  expect(screen.getByRole('heading', { name: 'Profile & settings' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Settings', exact: true }));
  const highExpenseAlerts = await screen.findByRole('checkbox', { name: 'High expense alerts' });
  fireEvent.click(highExpenseAlerts);
  expect(highExpenseAlerts).not.toBeChecked();
  expect(window.localStorage.getItem('finsight-alerts:fresh@example.com:highExpenseAlerts')).toBe('false');
  const notificationSounds = screen.getByRole('checkbox', { name: 'Notification sounds' });
  fireEvent.click(notificationSounds);
  expect(notificationSounds).toBeChecked();
  expect(window.localStorage.getItem('finsight-alerts:fresh@example.com:notificationSound')).toBe('true');
});

test('page search submits a matching name and navigates to that page', async () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Pull the cord' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Complete sign in' }));
  await screen.findByRole('button', { name: 'Sign out' }, { timeout: 3000 });

  fireEvent.change(screen.getByRole('textbox', { name: 'Search pages' }), { target: { value: 'budgets' } });
  expect(screen.getByRole('textbox', { name: 'Search pages' })).not.toHaveAttribute('list');
  fireEvent.submit(screen.getByRole('search'));

  expect(screen.getByRole('button', { name: 'Budgets' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('button', { name: 'Go to Dashboard' })).toBeInTheDocument();
});

test('profile details save through the API and update the signed-in greeting', async () => {
  global.fetch.mockImplementation((url, options = {}) => {
    if (url.endsWith('/api/auth/profile') && options.method === 'PUT') {
      const updatedProfile = JSON.parse(options.body);
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          ...updatedProfile,
          email: 'fresh@example.com',
        }),
      });
    }
    if (url.endsWith('/api/auth/profile')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          displayName: 'Fresh User',
          email: 'fresh@example.com',
          age: 30,
          gender: 'Prefer not to say',
          mobileNumber: null,
          address: null,
        }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(
        ['/api/transactions', '/api/accounts', '/api/budgets'].some((path) => url.endsWith(path))
          ? []
          : url.endsWith('/api/auth/profile')
            ? completedProfile('fresh@example.com')
            : { authenticated: true, email: 'person@example.com' }
      ),
    });
  });

  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Pull the cord' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Complete sign in' }));
  await screen.findByRole('button', { name: 'Sign out' }, { timeout: 3000 });
  fireEvent.click(screen.getByRole('button', { name: 'Open profile' }));
  const editDetails = await screen.findByRole('button', { name: 'Edit details' });
  await waitFor(() => expect(editDetails).toBeEnabled());
  expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
  fireEvent.click(editDetails);
  expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled();
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Casey Updated' } });
  fireEvent.change(screen.getByLabelText('Age'), { target: { value: '34' } });
  fireEvent.change(screen.getByLabelText('Gender'), { target: { value: 'Prefer not to say' } });
  fireEvent.change(screen.getByLabelText('Mobile number'), { target: { value: '+14155550123' } });
  fireEvent.change(screen.getByLabelText('Address'), { target: { value: '25 Example Street' } });
  fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

  expect(await screen.findByRole('status')).toHaveTextContent(/profile details have been updated/i);
  expect(screen.getAllByText('Casey Updated')).toHaveLength(2);
  expect(screen.getByText('34')).toBeInTheDocument();
  expect(screen.getByText('Prefer not to say')).toBeInTheDocument();
  expect(screen.getByText('+14155550123')).toBeInTheDocument();
  expect(screen.getByText('25 Example Street')).toBeInTheDocument();
  expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Open profile for Casey Updated' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
  expect(global.fetch).toHaveBeenCalledWith(`${API_BASE_URL}/api/auth/profile`, expect.objectContaining({
    method: 'PUT',
    credentials: 'include',
    body: JSON.stringify({
      displayName: 'Casey Updated',
      age: 34,
      gender: 'Prefer not to say',
      mobileNumber: '+14155550123',
      address: '25 Example Street',
    }),
  }));

  fireEvent.click(screen.getByRole('button', { name: 'Edit details' }));
  expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled();
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Casey Again' } });
  fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
  await waitFor(() => expect(screen.queryByLabelText('Name')).not.toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
  expect(screen.getAllByText('Casey Again')).toHaveLength(2);
  expect(screen.getByText('25 Example Street')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Open profile for Casey Again' })).toBeInTheDocument();
  expect(global.fetch.mock.calls.filter(([url, options]) => url.endsWith('/api/auth/profile') && options.method === 'PUT')).toHaveLength(2);
}, 10000);

test('signed-in users can change their password using only new and confirm fields', async () => {
  global.fetch.mockImplementation((url, options = {}) => {
    if (url.endsWith('/api/auth/password') && options.method === 'PUT') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ updated: true }) });
    }
    if (url.endsWith('/api/auth/profile')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          displayName: 'Fresh User',
          email: 'fresh@example.com',
          age: 30,
          gender: 'Prefer not to say',
          mobileNumber: null,
          address: null,
        }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(
        url.endsWith('/api/auth/profile')
          ? completedProfile()
          : ['/api/transactions', '/api/accounts', '/api/budgets'].some((path) => url.endsWith(path))
          ? []
          : { authenticated: true, email: 'person@example.com' }
      ),
    });
  });

  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Pull the cord' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Complete sign in' }));
  await screen.findByRole('button', { name: 'Sign out' }, { timeout: 3000 });
  fireEvent.click(screen.getByRole('button', { name: 'Open profile' }));
  fireEvent.click(screen.getByRole('button', { name: 'Settings', exact: true }));

  expect(await screen.findByLabelText('New password')).toBeInTheDocument();
  expect(screen.getByLabelText('Confirm new password')).toBeInTheDocument();
  expect(screen.queryByLabelText('Verification code')).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/Current password/)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'NewSecurePass123!' } });
  fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'NewSecurePass123!' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save password' }));

  expect(await screen.findByRole('status')).toHaveTextContent(/password has been updated/i);
  expect(global.fetch).toHaveBeenCalledWith(`${API_BASE_URL}/api/auth/password`, expect.objectContaining({
    method: 'PUT',
    credentials: 'include',
    body: JSON.stringify({ newPassword: 'NewSecurePass123!' }),
  }));
});

test('budget form saves an explicit weekly period and can download its PDF', async () => {
  global.fetch.mockImplementation((url, options = {}) => {
    if (url.endsWith('/api/budgets') && options.method === 'POST') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          id: 8,
          category: 'Food',
          amount: 125,
          periodType: 'WEEKLY',
          periodStart: '2026-11-16',
          month: '2026-11',
        }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(
        url.endsWith('/api/auth/profile')
          ? completedProfile()
          : ['/api/transactions', '/api/accounts', '/api/budgets'].some((path) => url.endsWith(path))
          ? []
          : { authenticated: true, email: 'person@example.com' }
      ),
    });
  });

  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Pull the cord' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Complete sign in' }));
  await screen.findByRole('button', { name: 'Sign out' }, { timeout: 3000 });
  fireEvent.click(screen.getByRole('button', { name: 'Budgets' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add Budget' }));
  fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Food' } });
  fireEvent.change(screen.getByLabelText('Budget limit (INR)'), { target: { value: '125' } });
  fireEvent.change(screen.getByLabelText('Budget period'), { target: { value: 'WEEKLY' } });
  fireEvent.change(screen.getByLabelText('Week containing'), { target: { value: '2026-11-18' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save budget' }));

  expect(await screen.findByText(/Weekly ·/)).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith(`${API_BASE_URL}/api/budgets`, expect.objectContaining({
    method: 'POST',
    body: JSON.stringify({
      category: 'Food',
      amount: 125,
      month: '2026-11',
      periodType: 'WEEKLY',
      periodStart: '2026-11-18',
    }),
  }));
  fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
  await waitFor(() => expect(jsPDF).toHaveBeenCalled());
  expect(jsPDF).toHaveBeenCalled();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(mockPdfSave).toHaveBeenCalledWith('finsight-weekly-budgets.pdf');
});

test('profile accepts a large photo and saves framing preferences', async () => {
  const PreviousFileReader = window.FileReader;
  const PreviousImage = window.Image;
  const canvasContext = { drawImage: jest.fn() };
  let setTimeoutSpy;
  let clearTimeoutSpy;
  let photoHoldCallback = null;
  class MockFileReader {
    result = 'data:image/png;base64,source';
    onload = null;
    onerror = null;
    readAsDataURL() {
      this.onload?.();
    }
  }
  class MockImage {
    width = 1024;
    height = 512;
    onload = null;
    onerror = null;
    set src(value) {
      if (value) this.onload?.();
    }
  }
  const getContext = jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(canvasContext);
  const toDataURL = jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,resized');
  window.FileReader = MockFileReader;
  window.Image = MockImage;

  try {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Pull the cord' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Complete sign in' }));
    await screen.findByRole('button', { name: 'Sign out' }, { timeout: 3000 });
    fireEvent.click(screen.getByRole('button', { name: 'Open profile' }));
    const editDetails = await screen.findByRole('button', { name: 'Edit details' });
    await waitFor(() => expect(editDetails).toBeEnabled());

    fireEvent.change(screen.getByLabelText('Upload profile picture'), {
      target: {
        files: [new File([new Uint8Array(2 * 1024 * 1024)], 'profile.png', { type: 'image/png' })],
      },
    });

    expect(window.localStorage.getItem('finsight-profile-photo:fresh@example.com')).toBe('data:image/jpeg;base64,resized');
    expect(canvasContext.drawImage).toHaveBeenCalled();
    expect(screen.getByLabelText('Adjust picture framing')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Adjust picture framing'), { target: { value: '1.5' } });
    expect(window.localStorage.getItem('finsight-profile-photo-zoom:fresh@example.com')).toBe('1.5');
    const photoButton = screen.getByRole('button', {
      name: 'Press and hold for 1 second to view the original profile picture',
    });
    const originalSetTimeout = window.setTimeout.bind(window);
    const originalClearTimeout = window.clearTimeout.bind(window);
    setTimeoutSpy = jest.spyOn(window, 'setTimeout').mockImplementation((callback, delay, ...args) => {
      if (delay === 1000) {
        photoHoldCallback = callback;
        return 999;
      }
      return originalSetTimeout(callback, delay, ...args);
    });
    clearTimeoutSpy = jest.spyOn(window, 'clearTimeout').mockImplementation((timeoutId) => {
      if (timeoutId === 999) {
        photoHoldCallback = null;
        return;
      }
      originalClearTimeout(timeoutId);
    });
    fireEvent.pointerDown(photoButton);
    expect(photoHoldCallback).toEqual(expect.any(Function));
    expect(screen.queryByRole('dialog', { name: 'Profile picture' })).not.toBeInTheDocument();
    fireEvent.pointerUp(photoButton);
    expect(photoHoldCallback).toBeNull();
    expect(screen.queryByRole('dialog', { name: 'Profile picture' })).not.toBeInTheDocument();
    fireEvent.pointerDown(photoButton);
    act(() => photoHoldCallback());
    const photoDialog = screen.getByRole('dialog', { name: 'Profile picture' });
    expect(photoDialog.querySelector('img')).toHaveAttribute('alt', 'Portrait of Fresh User');
    expect(photoDialog.querySelector('img')).not.toHaveAttribute('style');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Profile picture' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Go to Dashboard' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open profile' }));
    expect(screen.getByRole('heading', { name: 'Profile & settings' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Profile picture' })).not.toBeInTheDocument();
  } finally {
    window.FileReader = PreviousFileReader;
    window.Image = PreviousImage;
    if (setTimeoutSpy) setTimeoutSpy.mockRestore();
    if (clearTimeoutSpy) clearTimeoutSpy.mockRestore();
    getContext.mockRestore();
    toDataURL.mockRestore();
  }
});

test('transaction PDFs filter the selected day, week, or month', async () => {
  const savedTransactions = [
    { id: 1, description: 'November paycheck', category: 'Work', amount: 1000, type: 'income', transactionDate: '2026-11-16' },
    { id: 2, description: 'Groceries this Sunday', category: 'Food', amount: 80, type: 'expense', transactionDate: '2026-11-22' },
    { id: 3, description: 'Next week rent', category: 'Home', amount: 500, type: 'expense', transactionDate: '2026-11-23' },
    { id: 4, description: 'Early November bill', category: 'Bills', amount: 45, type: 'expense', transactionDate: '2026-11-02' },
    { id: 5, description: 'October bill', category: 'Bills', amount: 30, type: 'expense', transactionDate: '2026-10-31' },
    { id: 6, description: 'December bill', category: 'Bills', amount: 35, type: 'expense', transactionDate: '2026-12-01' },
  ];
  global.fetch.mockImplementation((url) => Promise.resolve({
    ok: true,
    json: () => Promise.resolve(    url.endsWith('/api/auth/profile') ? completedProfile() : url.endsWith('/api/transactions') ? savedTransactions : []),
  }));

  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Pull the cord' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Complete sign in' }));
  await screen.findByRole('button', { name: 'Sign out' }, { timeout: 3000 });
  await screen.findByText('November paycheck');
  fireEvent.click(screen.getByRole('button', { name: 'Transactions', exact: true }));

  fireEvent.change(screen.getByLabelText('PDF period'), { target: { value: 'WEEKLY' } });
  fireEvent.change(screen.getByLabelText('Week containing'), { target: { value: '2026-11-18' } });
  fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
  await waitFor(() => expect(mockPdfSave).toHaveBeenLastCalledWith('finsight-transactions-weekly-2026-11-16-to-2026-11-22.pdf'));
  expect(mockPdfSave).toHaveBeenLastCalledWith('finsight-transactions-weekly-2026-11-16-to-2026-11-22.pdf');
  let reportText = mockPdfText.mock.calls.map(([text]) => text).join(' ');
  expect(reportText).toContain('November paycheck');
  expect(reportText).toContain('Groceries this Sunday');
  expect(reportText).not.toContain('Next week rent');

  mockPdfText.mockClear();
  fireEvent.change(screen.getByLabelText('PDF period'), { target: { value: 'MONTHLY' } });
  fireEvent.change(screen.getByLabelText('Month'), { target: { value: '2026-11' } });
  fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
  await waitFor(() => expect(mockPdfSave).toHaveBeenLastCalledWith('finsight-transactions-monthly-2026-11-01-to-2026-11-30.pdf'));
  expect(mockPdfSave).toHaveBeenLastCalledWith('finsight-transactions-monthly-2026-11-01-to-2026-11-30.pdf');
  reportText = mockPdfText.mock.calls.map(([text]) => text).join(' ');
  expect(reportText).toContain('Next week rent');
  expect(reportText).toContain('Early November bill');
  expect(reportText).not.toContain('October bill');
  expect(reportText).not.toContain('December bill');

  mockPdfText.mockClear();
  fireEvent.change(screen.getByLabelText('PDF period'), { target: { value: 'DAILY' } });
  fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-11-22' } });
  fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
  await waitFor(() => expect(mockPdfSave).toHaveBeenLastCalledWith('finsight-transactions-daily-2026-11-22-to-2026-11-22.pdf'));
  expect(mockPdfSave).toHaveBeenLastCalledWith('finsight-transactions-daily-2026-11-22-to-2026-11-22.pdf');
  reportText = mockPdfText.mock.calls.map(([text]) => text).join(' ');
  expect(reportText).toContain('Groceries this Sunday');
  expect(reportText).not.toContain('November paycheck');
});

test('users can reset their transactions after confirming the destructive action', async () => {
  const savedTransaction = {
    id: 21,
    description: 'Sample expense',
    category: 'Food',
    amount: 125,
    type: 'expense',
    transactionDate: new Date().toISOString().slice(0, 10),
  };
  global.fetch.mockImplementation((url, options = {}) => {
    if (url.endsWith('/api/transactions') && options.method === 'DELETE') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ deleted: true, count: 1 }) });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(
        url.endsWith('/api/auth/session')
          ? { authenticated: true, email: 'reset@example.com' }
          : url.endsWith('/api/auth/profile')
            ? completedProfile('reset@example.com')
            : url.endsWith('/api/transactions') ? [savedTransaction] : []
      ),
    });
  });
  window.localStorage.setItem('finsight-authenticated', 'true');

  render(<App />);
  await screen.findByText('Sample expense');
  fireEvent.click(screen.getByRole('button', { name: 'Transactions', exact: true }));
  fireEvent.click(await screen.findByRole('button', { name: 'Reset transactions' }));

  const confirmation = screen.getByRole('alertdialog', { name: 'Reset all transactions?' });
  expect(confirmation).toHaveTextContent('Your accounts and budgets will remain.');
  fireEvent.click(within(confirmation).getByRole('button', { name: 'Reset transactions' }));

  expect(await screen.findByText('No transactions yet.')).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith(`${API_BASE_URL}/api/transactions`, {
    method: 'DELETE',
    credentials: 'include',
  });
});

test('camera selfies are captured, saved, and camera permission errors are explained', async () => {
  const previousMediaDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
  const track = { stop: jest.fn() };
  const stream = { getTracks: () => [track] };
  const getUserMedia = jest.fn().mockResolvedValue(stream);
  const canvasContext = { drawImage: jest.fn() };
  const getContext = jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(canvasContext);
  const toDataURL = jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,selfie');
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia },
  });

  try {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Pull the cord' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Complete sign in' }));
    await screen.findByRole('button', { name: 'Sign out' }, { timeout: 3000 });
    fireEvent.click(screen.getByRole('button', { name: 'Open profile' }));
    const editDetails = await screen.findByRole('button', { name: 'Edit details' });
    await waitFor(() => expect(editDetails).toBeEnabled());

    fireEvent.click(screen.getByRole('button', { name: 'Take a selfie' }));
    const dialog = await screen.findByRole('dialog', { name: 'Take a selfie' });
    expect(getUserMedia).toHaveBeenCalledWith({ video: { facingMode: 'user' }, audio: false });
    const video = screen.getByLabelText('Selfie camera preview');
    Object.defineProperty(video, 'videoWidth', { configurable: true, value: 1024 });
    Object.defineProperty(video, 'videoHeight', { configurable: true, value: 768 });
    fireEvent.canPlay(video);
    fireEvent.click(screen.getByRole('button', { name: 'Capture selfie' }));

    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(canvasContext.drawImage).toHaveBeenCalledWith(video, 0, 0, 512, 384);
    expect(window.localStorage.getItem('finsight-profile-photo:fresh@example.com')).toBe('data:image/jpeg;base64,selfie');
    await waitFor(() => expect(track.stop).toHaveBeenCalled());

    getUserMedia.mockRejectedValueOnce({ name: 'NotAllowedError' });
    fireEvent.click(screen.getByRole('button', { name: 'Take a selfie' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/camera permission was denied/i);
  } finally {
    if (previousMediaDevices) {
      Object.defineProperty(navigator, 'mediaDevices', previousMediaDevices);
    } else {
      delete navigator.mediaDevices;
    }
    getContext.mockRestore();
    toDataURL.mockRestore();
  }
});
