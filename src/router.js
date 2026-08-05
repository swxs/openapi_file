import { createRouter, createWebHistory } from "vue-router";
import FileCabinet from "./views/FileCabinet.vue";
import { getRefreshToken, getToken } from "./utils/auth";
import { exchangeCode, redirectToAuthorization } from "./utils/oauth";

const router = createRouter({
  history: createWebHistory(),
  routes: [
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
      async beforeEnter(to) {
        if (to.query.error) {
          return {
            path: "/",
            query: { auth_error: to.query.error_description || to.query.error },
          };
        }
        try {
          const destination = await exchangeCode(to.query.code, to.query.state);
          return destination.startsWith("/") ? destination : "/";
        } catch (error) {
          return {
            path: "/",
            query: { auth_error: error.message },
          };
        }
      },
    },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});

router.beforeEach((to) => {
  const callbackInSearch = new URLSearchParams(window.location.search);
  const code = callbackInSearch.get("code");
  const state = callbackInSearch.get("state");
  if (code && state && to.path !== "/oauth/callback") {
    return { path: "/oauth/callback", query: { code, state } };
  }
  if (to.meta.requiresAuth && !getToken() && !getRefreshToken()) {
    redirectToAuthorization(to.fullPath);
    return false;
  }
  return true;
});

export default router;
