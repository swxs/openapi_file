module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
    worker: true,
  },
  extends: ["plugin:vue/vue3-essential", "eslint:recommended", "@vue/prettier"],
  parserOptions: {
    ecmaVersion: "latest",
    parser: "@babel/eslint-parser",
    sourceType: "module",
  },
  rules: {
    "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
  },
};
