/**
 * OAuth2.0 客户端工具（与 openapi_user 机制对齐）
 */

import { setRefreshToken, setToken } from "./auth";

const OAUTH_CONFIG = {
  authorizationServer:
    process.env.VUE_APP_OAUTH_SERVER_URL || "http://127.0.0.1:8090",
  clientId: process.env.VUE_APP_OAUTH_CLIENT_ID || "",
  redirectUri:
    process.env.VUE_APP_OAUTH_REDIRECT_URI ||
    `${window.location.origin}/oauth/callback`,
  scope: process.env.VUE_APP_OAUTH_SCOPE || "read write",
};

const OAUTH_STATE_KEY = "oauth_state";
const OAUTH_REDIRECT_KEY = "oauth_redirect_uri";
const OAUTH_STATE_EXPIRES_MS = 30 * 1000;

let isExchangingToken = false;

export function generateState() {
  const array = new Uint32Array(1);
  window.crypto.getRandomValues(array);
  return array[0].toString(36) + Date.now().toString(36);
}

export function saveState(state) {
  const stateData = {
    value: state,
    expires: Date.now() + OAUTH_STATE_EXPIRES_MS,
  };
  localStorage.setItem(OAUTH_STATE_KEY, JSON.stringify(stateData));
}

export function getState() {
  const stateJson = localStorage.getItem(OAUTH_STATE_KEY);
  if (!stateJson) return null;

  try {
    const stateData = JSON.parse(stateJson);
    if (Date.now() > stateData.expires) {
      localStorage.removeItem(OAUTH_STATE_KEY);
      return null;
    }
    return stateData.value;
  } catch {
    localStorage.removeItem(OAUTH_STATE_KEY);
    return null;
  }
}

export function clearState() {
  localStorage.removeItem(OAUTH_STATE_KEY);
}

export function saveRedirectUri(uri) {
  const normalized = normalizeReturnPath(uri);
  localStorage.setItem(OAUTH_REDIRECT_KEY, normalized);
}

export function getAndClearRedirectUri() {
  const uri = localStorage.getItem(OAUTH_REDIRECT_KEY);
  if (uri) {
    localStorage.removeItem(OAUTH_REDIRECT_KEY);
  }
  return uri || "/";
}

function normalizeReturnPath(path = "/") {
  const value = String(path || "/").trim() || "/";
  if (value.startsWith("/oauth/callback")) {
    return "/";
  }
  return value.startsWith("/") ? value : `/${value}`;
}

export function buildAuthorizationUrl(state) {
  const params = new URLSearchParams({
    client_id: OAUTH_CONFIG.clientId,
    redirect_uri: OAUTH_CONFIG.redirectUri,
    response_type: "code",
    scope: OAUTH_CONFIG.scope,
    state,
  });
  return `${OAUTH_CONFIG.authorizationServer}/api/oauth/authorize?${params.toString()}`;
}

export function redirectToAuthorization(currentPath = "/") {
  const returnPath = normalizeReturnPath(
    currentPath || window.location.hash.slice(1) || "/",
  );
  saveRedirectUri(returnPath);
  const state = generateState();
  saveState(state);
  window.location.assign(buildAuthorizationUrl(state));
}

export async function handleOAuthCallback(code, state) {
  if (isExchangingToken) {
    return false;
  }

  const savedState = getState();
  if (!savedState || savedState !== state) {
    clearState();
    return false;
  }

  isExchangingToken = true;
  try {
    const tokenResponse = await exchangeCodeForToken(code);
    if (tokenResponse?.access_token) {
      setToken(tokenResponse.access_token);
      if (tokenResponse.refresh_token) {
        setRefreshToken(tokenResponse.refresh_token);
      }
      clearState();
      return true;
    }
    clearState();
    return false;
  } catch (error) {
    clearState();
    throw error;
  } finally {
    isExchangingToken = false;
  }
}

async function exchangeCodeForToken(code) {
  const formData = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: OAUTH_CONFIG.redirectUri,
    client_id: OAUTH_CONFIG.clientId,
    client_secret: process.env.VUE_APP_OAUTH_CLIENT_SECRET || "",
  });

  const tokenUrl = `${OAUTH_CONFIG.authorizationServer}/api/oauth/token`;
  let response;
  try {
    response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });
  } catch (fetchError) {
    const message = fetchError.message || "网络请求失败";
    if (
      message.includes("Failed to fetch") ||
      message.includes("NetworkError")
    ) {
      throw new Error(
        `CORS错误: 无法连接到授权服务器 (${window.location.origin})`,
      );
    }
    throw new Error(`网络错误: ${message}`);
  }

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text || "获取 token 失败"}`);
    }
    throw new Error(
      errorData.message ||
        errorData.error_description ||
        errorData.error ||
        "获取 token 失败",
    );
  }

  return response.json();
}

export async function refreshAccessToken(refreshToken) {
  const formData = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: OAUTH_CONFIG.clientId,
    client_secret: process.env.VUE_APP_OAUTH_CLIENT_SECRET || "",
  });

  const response = await fetch(
    `${OAUTH_CONFIG.authorizationServer}/api/oauth/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    },
  );

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text || "刷新 token 失败"}`);
    }
    throw new Error(
      errorData.message ||
        errorData.error_description ||
        errorData.error ||
        "刷新 token 失败",
    );
  }

  const tokenResponse = await response.json();
  setToken(tokenResponse.access_token);
  if (tokenResponse.refresh_token) {
    setRefreshToken(tokenResponse.refresh_token);
  }
  return tokenResponse;
}

export function parseOAuthCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get("code");
  const state = urlParams.get("state");
  const error = urlParams.get("error");
  const errorDescription = urlParams.get("error_description");
  const token = urlParams.get("token");

  if (error) {
    return { error, errorDescription };
  }

  if (code && state) {
    return { code, state };
  }

  if (token) {
    return {
      error: "invalid_request",
      errorDescription:
        "回调 URL 含 token 参数但缺少 code/state，请确认 OAuth Client 使用授权码模式",
    };
  }

  return null;
}
