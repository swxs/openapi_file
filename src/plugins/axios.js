import axios from "axios";
import { getRefreshToken, getToken, removeToken } from "../utils/auth";
import { redirectToAuthorization, refreshAccessToken } from "../utils/oauth";

const service = axios.create({
  baseURL: process.env.VUE_APP_API_BASE_URL || "",
  timeout: 20000,
});

let refreshPromise = null;

async function ensureAccessToken() {
  const accessToken = getToken();
  if (accessToken) return accessToken;
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  refreshPromise ||= refreshAccessToken(refreshToken).finally(() => {
    refreshPromise = null;
  });
  const result = await refreshPromise;
  return result.access_token;
}

service.interceptors.request.use(async (config) => {
  const token = await ensureAccessToken();
  if (!token) {
    redirectToAuthorization(
      `${window.location.pathname}${window.location.search}${window.location.hash}`,
    );
    return Promise.reject(new axios.Cancel("正在跳转到登录页"));
  }
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});

service.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const request = error.config;
    if (error.response?.status === 401 && request && !request._retried) {
      request._retried = true;
      try {
        const refreshToken = getRefreshToken();
        if (!refreshToken) throw new Error("refresh token 不存在");
        const result = await refreshAccessToken(refreshToken);
        request.headers.Authorization = `Bearer ${result.access_token}`;
        return service(request);
      } catch {
        removeToken();
        redirectToAuthorization(window.location.hash.slice(1) || "/");
      }
    }
    return Promise.reject(error);
  },
);

export default service;
