module.exports = {
  devServer: {
    port: 8084,
    hot: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8090",
        changeOrigin: true,
      },
    },
  },
  configureWebpack: {
    resolve: {
      alias: {
        vue: "vue",
      },
    },
  },
};
