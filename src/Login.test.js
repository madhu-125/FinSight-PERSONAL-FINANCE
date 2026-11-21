import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Login, { PullLamp } from './Login';

const API_BASE_URL = process.env.REACT_APP_API_URL || '';

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
  expect(screen.queryByRole('button', { name: /pull the cord/i })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /back/i }));
  expect(onBackToLanding).toHaveBeenCalledTimes(1);

  unmount();
  getContext.mockRestore();
  requestAnimationFrame.mockRestore();
});

test('demo sign-in accepts arbitrary credentials and skips OTP verification', async () => {
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
  const previousDemoAuth = process.env.REACT_APP_DEMO_AUTH;
  const onLogin = jest.fn();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ authenticated: true }),
  });
  process.env.REACT_APP_DEMO_AUTH = 'true';

  const { unmount } = render(<Login onLogin={onLogin} />);
  fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'anything' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'x' } });
  fireEvent.click(screen.getByRole('button', { name: /continue with email/i }));

  try {
    await waitFor(() => expect(onLogin).toHaveBeenCalledWith({
      name: 'anything',
      email: 'anything',
      phone: '',
      channel: 'email',
      remember: false,
    }));
    expect(global.fetch).toHaveBeenCalledWith(`${API_BASE_URL}/api/auth/demo`, expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ channel: 'email', email: 'anything' }),
    }));
    expect(screen.queryByLabelText('Verification code')).not.toBeInTheDocument();
  } finally {
    unmount();
    getContext.mockRestore();
    requestAnimationFrame.mockRestore();
    global.fetch = previousFetch;
    if (previousDemoAuth === undefined) delete process.env.REACT_APP_DEMO_AUTH;
    else process.env.REACT_APP_DEMO_AUTH = previousDemoAuth;
  }
});

test('login sends an email code and completes sign-in after verification', async () => {
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
  const previousDemoAuth = process.env.REACT_APP_DEMO_AUTH;
  const onLogin = jest.fn();
  process.env.REACT_APP_DEMO_AUTH = 'false';
  global.fetch = jest.fn()
    .mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ sent: true, resendAfterSeconds: 0 }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ verified: true }),
    });

  const { unmount } = render(<Login onLogin={onLogin} />);
  fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'person@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'demo-password' } });
  fireEvent.click(screen.getByRole('button', { name: /continue with email/i }));

  try {
    const otpInput = await screen.findByLabelText('Verification code');
    fireEvent.change(otpInput, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /verify and continue/i }));

    await waitFor(() => expect(onLogin).toHaveBeenCalledWith({
      name: 'Alex Morgan',
      email: 'person@example.com',
      phone: '',
      channel: 'email',
      remember: false,
    }));
    expect(global.fetch).toHaveBeenNthCalledWith(1, `${API_BASE_URL}/api/auth/otp/send`, expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ channel: 'email', email: 'person@example.com' }),
    }));
    expect(global.fetch).toHaveBeenNthCalledWith(2, `${API_BASE_URL}/api/auth/otp/verify`, expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ channel: 'email', email: 'person@example.com', code: '123456' }),
    }));
  } finally {
    unmount();
    getContext.mockRestore();
    requestAnimationFrame.mockRestore();
    global.fetch = previousFetch;
    if (previousDemoAuth === undefined) delete process.env.REACT_APP_DEMO_AUTH;
    else process.env.REACT_APP_DEMO_AUTH = previousDemoAuth;
  }
});

test('login sends and verifies an SMS code using an international phone number', async () => {
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
  const previousDemoAuth = process.env.REACT_APP_DEMO_AUTH;
  const onLogin = jest.fn();
  process.env.REACT_APP_DEMO_AUTH = 'false';
  global.fetch = jest.fn()
    .mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ sent: true, resendAfterSeconds: 0 }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ verified: true }),
    });

  const { unmount } = render(<Login onLogin={onLogin} />);
  fireEvent.click(screen.getByRole('button', { name: 'SMS' }));
  fireEvent.change(screen.getByLabelText('Mobile phone number'), { target: { value: '+14155550123' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'demo-password' } });
  fireEvent.click(screen.getByRole('button', { name: /continue with sms/i }));

  try {
    expect(await screen.findByRole('heading', { name: 'Verify your phone' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Verification code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /verify and continue/i }));

    await waitFor(() => expect(onLogin).toHaveBeenCalledWith({
      name: 'Alex Morgan',
      email: '',
      phone: '+14155550123',
      channel: 'sms',
      remember: false,
    }));
    expect(global.fetch).toHaveBeenNthCalledWith(1, `${API_BASE_URL}/api/auth/otp/send`, expect.objectContaining({
      body: JSON.stringify({ channel: 'sms', phone: '+14155550123' }),
    }));
    expect(global.fetch).toHaveBeenNthCalledWith(2, `${API_BASE_URL}/api/auth/otp/verify`, expect.objectContaining({
      body: JSON.stringify({ channel: 'sms', phone: '+14155550123', code: '123456' }),
    }));
  } finally {
    unmount();
    getContext.mockRestore();
    requestAnimationFrame.mockRestore();
    global.fetch = previousFetch;
    if (previousDemoAuth === undefined) delete process.env.REACT_APP_DEMO_AUTH;
    else process.env.REACT_APP_DEMO_AUTH = previousDemoAuth;
  }
});
