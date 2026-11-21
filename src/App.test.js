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
