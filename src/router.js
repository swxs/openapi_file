import { createRouter, createWebHashHistory } from "vue-router";
import FileCabinet from "./views/FileCabinet.vue";
import { getRefreshToken, getToken } from "./utils/auth";
import {
  getAndClearRedirectUri,
  handleOAuthCallback,
  parseOAuthCallback,
  redirectToAuthorization,
} from "./utils/oauth";

const routes = [
  {
    path: "/",
    name: "files",
    component: FileCabinet,
    meta: { requiresAuth: true },
  },
  {
    path: "/oauth/callback",
    name: "oauth-callback",
    component: {
      template:
        '<div class="oauth-state"><strong>正在核验凭证</strong><span>请稍候，不要关闭页面。</span></div>',
    },
    beforeEnter: async () => {
      const callbackParams = parseOAuthCallback();

      if (!callbackParams) {
        window.location.replace(`${window.location.origin}/#/`);
        return false;
      }

      if (callbackParams.error) {
        const encoded = encodeURIComponent(
          callbackParams.errorDescription || callbackParams.error,
        );
        window.location.replace(
          `${window.location.origin}/#/?auth_error=${encoded}`,
        );
        return false;
      }

      try {
        const success = await handleOAuthCallback(
          callbackParams.code,
          callbackParams.state,
        );
        if (success) {
          const redirectUri = getAndClearRedirectUri();
          const targetPath = redirectUri.startsWith("/")
            ? redirectUri
            : `/${redirectUri}`;
          window.location.replace(`${window.location.origin}/#${targetPath}`);
        } else {
          window.location.replace(
            `${window.location.origin}/#/?auth_error=authorization_failed`,
          );
        }
      } catch (error) {
        const encoded = encodeURIComponent(
          error.message || "authorization_failed",
        );
        window.location.replace(
          `${window.location.origin}/#/?auth_error=${encoded}`,
        );
      }
      return false;
    },
  },
  { path: "/:pathMatch(.*)*", redirect: "/" },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

router.beforeEach((to, from, next) => {
  const urlParams = new URLSearchParams(window.location.search);
  const hasOAuthCode = urlParams.get("code");
  const hasOAuthState = urlParams.get("state");
  const hasOAuthError = urlParams.get("error");

  if ((hasOAuthCode && hasOAuthState) || hasOAuthError) {
    if (to.path === "/oauth/callback") {
      next();
      return;
    }
    const query = {};
    if (hasOAuthCode) query.code = hasOAuthCode;
    if (hasOAuthState) query.state = hasOAuthState;
    if (hasOAuthError) query.error = hasOAuthError;
    if (urlParams.get("error_description")) {
      query.error_description = urlParams.get("error_description");
    }
    next({ path: "/oauth/callback", query, replace: true });
    return;
  }

  if (to.matched.some((record) => record.meta.requiresAuth)) {
    if (getToken() || getRefreshToken()) {
      next();
      return;
    }
    redirectToAuthorization(to.fullPath);
    return;
  }

  next();
});

export default router;
