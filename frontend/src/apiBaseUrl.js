// Selects the API origin for local development and deployed frontend builds.
const LOCAL_HOSTNAMES = ["localhost", "127.0.0.1"];

export function getApiBaseUrl(configuredUrl, browserHostname) {
  if (!configuredUrl) return "";

  const bareRenderHostname = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(configuredUrl);
  const url = /^[a-z][a-z\d+.-]*:\/\//i.test(configuredUrl)
    ? configuredUrl
    : `https://${bareRenderHostname ? `${configuredUrl}.onrender.com` : configuredUrl}`;
  const apiUrl = new URL(url, window.location.origin);
  if (
    LOCAL_HOSTNAMES.includes(browserHostname)
    && LOCAL_HOSTNAMES.includes(apiUrl.hostname)
  ) {
    apiUrl.hostname = browserHostname;
  }
  return apiUrl.origin;
}

export const API_BASE_URL = getApiBaseUrl(
  process.env.REACT_APP_API_URL || "",
  window.location.hostname
);
