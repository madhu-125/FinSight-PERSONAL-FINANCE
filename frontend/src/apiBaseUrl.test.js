// Verifies API-origin selection for local and deployed environments.
import { getApiBaseUrl } from './apiBaseUrl';

test('matches localhost API requests to the browser loopback hostname', () => {
  expect(getApiBaseUrl('http://localhost:8080', '127.0.0.1')).toBe('http://127.0.0.1:8080');
});

test('matches 127.0.0.1 API requests to the browser localhost hostname', () => {
  expect(getApiBaseUrl('http://127.0.0.1:8080', 'localhost')).toBe('http://localhost:8080');
});

test('uses the phone or computer LAN hostname for a local API', () => {
  expect(getApiBaseUrl('http://localhost:4000', '192.168.1.47')).toBe('http://192.168.1.47:4000');
});

test('leaves configured non-loopback API hosts unchanged', () => {
  expect(getApiBaseUrl('https://api.example.test', 'localhost')).toBe('https://api.example.test');
});

test('uses HTTPS for Render service host references without a scheme', () => {
  expect(getApiBaseUrl('finsight-api.onrender.com', 'finsight-web.onrender.com'))
    .toBe('https://finsight-api.onrender.com');
});

test('adds the Render domain to a bare service hostname', () => {
  expect(getApiBaseUrl('finsight-api-ne8t', 'finsight-web-p9bg.onrender.com'))
    .toBe('https://finsight-api-ne8t.onrender.com');
});

test('adds the Render domain to a bare service hostname that already has a scheme', () => {
  expect(getApiBaseUrl('https://finsight-api-ne8t', 'finsight-web-p9bg.onrender.com'))
    .toBe('https://finsight-api-ne8t.onrender.com');
});
