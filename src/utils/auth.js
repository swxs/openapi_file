const ACCESS_TOKEN_KEY = "openapi_file_access_token";
const REFRESH_TOKEN_KEY = "openapi_file_refresh_token";

function decodePayload(token) {
  try {
    const payload = token.split(".")[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(decodeURIComponent(escape(window.atob(normalized))));
  } catch {
    return {};
  }
}

function readValidToken(key) {
  const token = localStorage.getItem(key);
  if (!token) return null;
  const { exp } = decodePayload(token);
  if (exp && exp * 1000 <= Date.now()) {
    localStorage.removeItem(key);
    return null;
  }
  return token;
}

export const getToken = () => readValidToken(ACCESS_TOKEN_KEY);
export const getRefreshToken = () => readValidToken(REFRESH_TOKEN_KEY);
export const getTokenInfo = () => decodePayload(getToken() || "");

export function setToken(token) {
  if (token) localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function setRefreshToken(token) {
  if (token) localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function removeToken() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}
