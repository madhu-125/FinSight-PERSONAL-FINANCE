// Verifies API-origin selection for local and deployed environments.
import { getApiBaseUrl } from './apiBaseUrl';

test('matches localhost API requests to the browser loopback hostname', () => {
  expect(getApiBaseUrl('http://localhost:8080', '127.0.0.1')).toBe('http://127.0.0.1:8080');
});

test('matches 127.0.0.1 API requests to the browser localhost hostname', () => {
  expect(getApiBaseUrl('http://127.0.0.1:8080', 'localhost')).toBe('http://localhost:8080');
});

test('leaves configured non-loopback API hosts unchanged', () => {
  expect(getApiBaseUrl('https://api.example.test', 'localhost')).toBe('https://api.example.test');
});
