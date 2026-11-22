// Selects the API origin for local development and deployed frontend builds.
const LOCAL_HOSTNAMES = ["localhost", "127.0.0.1"];

export function getApiBaseUrl(configuredUrl, browserHostname) {
  if (!configuredUrl?.trim()) return "";

  const value = configuredUrl.trim();
  const hasScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(value);
  const apiUrl = new URL(hasScheme ? value : `https://${value}`, window.location.origin);
  const bareRenderHostname = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(apiUrl.hostname);
  if (!LOCAL_HOSTNAMES.includes(apiUrl.hostname) && bareRenderHostname) {
    apiUrl.hostname = `${apiUrl.hostname}.onrender.com`;
  }
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
