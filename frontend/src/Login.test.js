// Covers sign-in, registration, and verification interactions.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Login, { PullLamp } from './Login';
import { API_BASE_URL } from './apiBaseUrl';

test('pulling the lamp cord down triggers its action', () => {
  const onPull = jest.fn();
  render(<PullLamp lampOn={false} onPull={onPull} />);
  const cord = screen.getByRole('button', { name: /pull the cord/i });
  const createPointerEvent = (type, clientY) => {
    const event = new Event(type, { bubbles: true });
    Object.defineProperty(event, 'clientY', { value: clientY });
    return event;
  };

  fireEvent(cord, createPointerEvent('pointerdown', 100));
  fireEvent(cord, createPointerEvent('pointerup', 130));

  expect(onPull).toHaveBeenCalledTimes(1);
});

test('the lamp cord remains operable with a click', () => {
  const onPull = jest.fn();
  render(<PullLamp lampOn={false} onPull={onPull} />);

  fireEvent.click(screen.getByRole('button', { name: /pull the cord/i }));

  expect(onPull).toHaveBeenCalledTimes(1);
});

test('login displays the sign-in form without a lamp', () => {
  const canvasContext = {
    setTransform: jest.fn(),
    clearRect: jest.fn(),
    beginPath: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
  };
  const getContext = jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(canvasContext);
  const requestAnimationFrame = jest.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
  const onBackToLanding = jest.fn();
  const { unmount } = render(<Login onLogin={jest.fn()} onBackToLanding={onBackToLanding} />);

  expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
  expect(screen.getByLabelText('Password')).toBeRequired();
  expect(screen.queryByRole('button', { name: 'One-time code' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Mobile' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'SMS' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Google' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Apple' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /pull the cord/i })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /back/i }));
  expect(onBackToLanding).toHaveBeenCalledTimes(1);

  unmount();
  getContext.mockRestore();
  requestAnimationFrame.mockRestore();
});

test('mobile sign-in verifies the password without sending an OTP', async () => {
  const canvasContext = {
    setTransform: jest.fn(),
    clearRect: jest.fn(),
    beginPath: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
  };
  const getContext = jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(canvasContext);
  const requestAnimationFrame = jest.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
  const previousFetch = global.fetch;
  const onLogin = jest.fn();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ displayName: 'Casey' }),
  });

  const { unmount } = render(<Login onLogin={onLogin} />);
  fireEvent.click(screen.getByRole('button', { name: 'Mobile' }));
  fireEvent.change(screen.getByLabelText('Mobile phone number'), { target: { value: '9876543210' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret-password' } });
  fireEvent.submit(screen.getByLabelText('Password').closest('form'));

  try {
    await waitFor(() => expect(onLogin).toHaveBeenCalledWith({
      name: 'Casey',
      email: '',
      phone: '+919876543210',
      channel: 'sms',
      remember: false,
    }));
    expect(global.fetch).toHaveBeenCalledWith(`${API_BASE_URL}/api/auth/password/login`, expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ channel: 'sms', phone: '+919876543210', password: 'secret-password' }),
    }));
    expect(global.fetch).not.toHaveBeenCalledWith(`${API_BASE_URL}/api/auth/otp/send`, expect.anything());
  } finally {
    unmount();
    getContext.mockRestore();
    requestAnimationFrame.mockRestore();
    global.fetch = previousFetch;
  }
});

test('email sign-in verifies the password without sending an OTP', async () => {
  const canvasContext = {
    setTransform: jest.fn(),
    clearRect: jest.fn(),
    beginPath: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
  };
  const getContext = jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(canvasContext);
  const requestAnimationFrame = jest.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
  const previousFetch = global.fetch;
  const onLogin = jest.fn();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ displayName: 'Casey' }),
  });

  const { unmount } = render(<Login onLogin={onLogin} />);
  fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'casey@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret-password' } });
  fireEvent.submit(screen.getByLabelText('Password').closest('form'));

  try {
    await waitFor(() => expect(onLogin).toHaveBeenCalledWith({
      name: 'Casey',
      email: 'casey@example.com',
      phone: '',
      channel: 'email',
      remember: false,
    }));
    expect(global.fetch).toHaveBeenCalledWith(`${API_BASE_URL}/api/auth/password/login`, expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ channel: 'email', email: 'casey@example.com', password: 'secret-password' }),
    }));
    expect(global.fetch).not.toHaveBeenCalledWith(`${API_BASE_URL}/api/auth/otp/send`, expect.anything());
  } finally {
    unmount();
    getContext.mockRestore();
    requestAnimationFrame.mockRestore();
    global.fetch = previousFetch;
  }
});

test('password reset requests a code and submits a matching new password', async () => {
  const canvasContext = {
    setTransform: jest.fn(),
    clearRect: jest.fn(),
    beginPath: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
  };
  const getContext = jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(canvasContext);
  const requestAnimationFrame = jest.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
  const previousFetch = global.fetch;
  global.fetch = jest.fn()
    .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ sent: true }) })
    .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ reset: true }) });

  const { unmount } = render(<Login onLogin={jest.fn()} />);
  fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'casey@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
  fireEvent.click(screen.getByRole('button', { name: /send reset code/i }));

  try {
    expect(await screen.findByLabelText('Verification code')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Verification code'), { target: { value: '654321' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'new-password' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'new-password' } });
    fireEvent.click(screen.getByRole('button', { name: /update password/i }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    expect(global.fetch).toHaveBeenNthCalledWith(1, `${API_BASE_URL}/api/auth/password/forgot`, expect.objectContaining({
      body: JSON.stringify({ channel: 'email', email: 'casey@example.com' }),
    }));
    expect(global.fetch).toHaveBeenNthCalledWith(2, `${API_BASE_URL}/api/auth/password/reset`, expect.objectContaining({
      body: JSON.stringify({
        channel: 'email',
        email: 'casey@example.com',
        code: '654321',
        newPassword: 'new-password',
      }),
    }));
    expect(await screen.findByRole('status')).toHaveTextContent(/password updated/i);
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  } finally {
    unmount();
    getContext.mockRestore();
    requestAnimationFrame.mockRestore();
    global.fetch = previousFetch;
  }
});

test('email reset setup errors do not expose server configuration or social sign-in', async () => {
  const canvasContext = {
    setTransform: jest.fn(),
    clearRect: jest.fn(),
    beginPath: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
  };
  const getContext = jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(canvasContext);
  const requestAnimationFrame = jest.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
  const previousFetch = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    json: () => Promise.resolve({
      error: 'Email verification needs RESEND_API_KEY and a verified RESEND_FROM_EMAIL.',
    }),
  });

  const { unmount } = render(<Login onLogin={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
  fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'casey@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: /send reset code/i }));

  try {
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/email password reset is unavailable/i);
    expect(alert).not.toHaveTextContent(/RESEND_API_KEY/);
    expect(screen.queryByRole('button', { name: 'Google' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Apple' })).not.toBeInTheDocument();
  } finally {
    unmount();
    getContext.mockRestore();
    requestAnimationFrame.mockRestore();
    global.fetch = previousFetch;
  }
});

test('email sign-up sends a code and creates the account after verification', async () => {
  const canvasContext = {
    setTransform: jest.fn(),
    clearRect: jest.fn(),
    beginPath: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
  };
  const getContext = jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(canvasContext);
  const requestAnimationFrame = jest.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
  const previousFetch = global.fetch;
  const onLogin = jest.fn();
  global.fetch = jest.fn()
    .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ sent: true, resendAfterSeconds: 0 }) })
    .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ displayName: 'Casey Jones' }) });

  const { unmount } = render(<Login onLogin={onLogin} />);
  fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }));
  fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Casey Jones' } });
  fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'casey@example.com' } });
  fireEvent.change(screen.getByLabelText('Create password'), { target: { value: 'secure-password' } });
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'secure-password' } });
  fireEvent.click(screen.getByRole('button', { name: /create account/i }));

  try {
    fireEvent.change(await screen.findByLabelText('Verification code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /verify and continue/i }));

    await waitFor(() => expect(onLogin).toHaveBeenCalledWith({
      name: 'Casey Jones',
      email: 'casey@example.com',
      phone: '',
      channel: 'email',
      remember: false,
    }));
    expect(global.fetch).toHaveBeenNthCalledWith(1, `${API_BASE_URL}/api/auth/otp/send`, expect.objectContaining({
      body: JSON.stringify({ channel: 'email', email: 'casey@example.com' }),
    }));
    expect(global.fetch).toHaveBeenNthCalledWith(2, `${API_BASE_URL}/api/auth/otp/verify`, expect.objectContaining({
      body: JSON.stringify({
        channel: 'email',
        email: 'casey@example.com',
        code: '123456',
        displayName: 'Casey Jones',
        password: 'secure-password',
      }),
    }));
  } finally {
    unmount();
    getContext.mockRestore();
    requestAnimationFrame.mockRestore();
    global.fetch = previousFetch;
  }
});
