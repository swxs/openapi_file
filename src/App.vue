<template>
  <a-config-provider :theme="theme">
    <router-view />
  </a-config-provider>
</template>

<script setup>
const theme = {
  token: {
    colorPrimary: "#34584b",
    colorInfo: "#34584b",
    colorSuccess: "#48755f",
    colorWarning: "#bd642c",
    colorError: "#9f3f31",
    colorText: "#17201d",
    colorBgContainer: "#f8f5ed",
    borderRadius: 2,
    fontFamily:
      "'Source Han Sans SC', 'Microsoft YaHei UI', 'Microsoft YaHei', sans-serif",
  },
};
</script>

<style lang="less">
* {
  box-sizing: border-box;
}

html,
body,
#app {
  min-width: 320px;
  min-height: 100%;
  margin: 0;
}

body {
  color: #17201d;
  font-family:
    "Source Han Sans SC", "Microsoft YaHei UI", "Microsoft YaHei", sans-serif;
  background: #f1eee5;
}

button,
input,
textarea,
select {
  font: inherit;
}

.oauth-state {
  display: grid;
  min-height: 100vh;
  place-content: center;
  gap: 10px;
  color: #f1eee5;
  text-align: center;
  background: #17201d;

  strong {
    font-family: "Noto Serif SC", "SimSun", serif;
    font-size: 28px;
  }

  span {
    color: #98a29d;
    font-size: 12px;
  }
}

::selection {
  color: white;
  background: #bd642c;
}
</style>
