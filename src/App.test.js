import { act, fireEvent, render, screen } from '@testing-library/react';
import App from './App';

const API_BASE_URL = process.env.REACT_APP_API_URL || '';

jest.mock('./Login', () => ({
  __esModule: true,
  default: function MockLogin({ onLogin }) {
    return <button type="button" onClick={onLogin}>Complete sign in</button>;
  },
  PullLamp: function MockPullLamp({ onPull }) {
    return <button type="button" onClick={onPull}>Pull the cord</button>;
  },
}));

const originalFetch = global.fetch;

beforeEach(() => {
  window.localStorage.clear();
  global.fetch = jest.fn((url) => Promise.resolve({
    ok: true,
    json: () => Promise.resolve(url.endsWith('/api/auth/session')
      ? { authenticated: true, email: 'person@example.com' }
      : url.endsWith('/api/transactions')
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

  expect(screen.getByRole('heading', { name: /make every money move/i })).toBeInTheDocument();
  expect(screen.getByText('PULL THE LAMP THREAD TO SIGN IN')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Pull the cord' }));

  act(() => {
    jest.advanceTimersByTime(500);
  });
  fireEvent.click(screen.getByRole('button', { name: 'Complete sign in' }));
  expect(window.localStorage.getItem('finsight-authenticated')).toBe('true');
  expect(screen.getByRole('status')).toHaveTextContent(/preparing your dashboard/i);

  act(() => {
    jest.advanceTimersByTime(1600);
  });
  expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  expect(screen.getByText('₹1,24,500')).toBeInTheDocument();
  expect(screen.getByText('No transactions yet.')).toBeInTheDocument();
  expect(screen.queryByText('Grocery Shopping')).not.toBeInTheDocument();

  app.unmount();
  render(<App />);
  await act(async () => {
    await Promise.resolve();
  });
  expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await Promise.resolve();
  });
  expect(window.localStorage.getItem('finsight-authenticated')).toBeNull();
  expect(screen.getByRole('heading', { name: /make every money move/i })).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith(`${API_BASE_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' });
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

  expect(screen.getByRole('heading', { name: /make every money move/i })).toBeInTheDocument();
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
      json: () => Promise.resolve(url.endsWith('/api/transactions') ? [] : { loggedOut: true }),
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
      json: () => Promise.resolve(url.endsWith('/api/transactions') ? [] : []),
    });
  });

  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Pull the cord' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Complete sign in' }));
  await screen.findByRole('button', { name: 'Sign out' }, { timeout: 3000 });

  fireEvent.click(screen.getByRole('button', { name: 'Accounts' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add Account' }));
  fireEvent.change(screen.getByLabelText('Account name'), { target: { value: 'Main savings' } });
  fireEvent.change(screen.getByLabelText('Current balance (INR)'), { target: { value: '1250' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save account' }));
  expect(await screen.findByText('Main savings')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Budgets' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add Budget' }));
  fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Food' } });
  fireEvent.change(screen.getByLabelText('Monthly limit (INR)'), { target: { value: '500' } });
  const month = screen.getByLabelText('Month').value;
  fireEvent.click(screen.getByRole('button', { name: 'Save budget' }));
  expect(await screen.findByText('Food')).toBeInTheDocument();

  expect(global.fetch).toHaveBeenCalledWith(`${API_BASE_URL}/api/accounts`, expect.objectContaining({
    method: 'POST',
    body: JSON.stringify({ name: 'Main savings', type: 'checking', balance: 1250 }),
  }));
  expect(global.fetch).toHaveBeenCalledWith(`${API_BASE_URL}/api/budgets`, expect.objectContaining({
    method: 'POST',
    body: JSON.stringify({ category: 'Food', amount: 500, month }),
  }));
});

test('analytics summarizes saved transactions and shows category spending', async () => {
  const now = new Date();
  const transactionDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  global.fetch.mockImplementation((url) => Promise.resolve({
    ok: true,
    json: () => Promise.resolve(url.endsWith('/api/transactions') ? [
      { id: 1, description: 'Salary', category: 'Work', amount: 2500, type: 'income', transactionDate },
      { id: 2, description: 'Groceries', category: 'Food', amount: 600, type: 'expense', transactionDate },
      { id: 3, description: 'Electricity', category: 'Bills', amount: 200, type: 'expense', transactionDate },
    ] : { authenticated: true, email: 'person@example.com' }),
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
