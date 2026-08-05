import { setRefreshToken, setToken } from "./auth";

const STATE_KEY = "openapi_file_oauth_state";
const RETURN_KEY = "openapi_file_oauth_return";
const config = {
  server: process.env.VUE_APP_OAUTH_SERVER_URL || "http://127.0.0.1:8090",
  clientId: process.env.VUE_APP_OAUTH_CLIENT_ID || "",
  clientSecret: process.env.VUE_APP_OAUTH_CLIENT_SECRET || "",
  redirectUri:
    process.env.VUE_APP_OAUTH_REDIRECT_URI ||
    `${window.location.origin}/oauth/callback`,
  scope: process.env.VUE_APP_OAUTH_SCOPE || "read write",
};

function createState() {
  const values = new Uint32Array(4);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => value.toString(36)).join("");
}

export function redirectToAuthorization(returnTo = "/") {
  const state = createState();
  sessionStorage.setItem(STATE_KEY, state);
  sessionStorage.setItem(RETURN_KEY, returnTo);
  const query = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: config.scope,
    state,
  });
  window.location.assign(`${config.server}/api/oauth/authorize?${query}`);
}

async function requestToken(parameters) {
  const response = await fetch(`${config.server}/api/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      ...parameters,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      result.error_description || result.message || "OAuth token 请求失败",
    );
  }
  setToken(result.access_token);
  setRefreshToken(result.refresh_token);
  return result;
}

export async function exchangeCode(code, state) {
  const expectedState = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(STATE_KEY);
  if (!expectedState || expectedState !== state) {
    throw new Error("OAuth state 校验失败，请重新登录");
  }
  await requestToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
  });
  const returnTo = sessionStorage.getItem(RETURN_KEY) || "/";
  sessionStorage.removeItem(RETURN_KEY);
  return returnTo;
}

export function refreshAccessToken(refreshToken) {
  return requestToken({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
}
