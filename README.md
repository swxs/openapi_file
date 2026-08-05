# openapi_file

面向个人用户的轻量网盘前端。文件通过 Presigned URL 直接上传到阿里云 OSS，`home` API 仅负责鉴权、签名、校验和文件元数据。

## 本地开发

要求 Node.js 20+。默认开发端口为 `8084`，`/api` 代理到 `http://127.0.0.1:8090`。

```powershell
copy .env.development.example .env.development.local
npm install
npm run dev
```

在 `.env.development.local` 中填写独立 OAuth Client 的 `client_id`、`client_secret` 和回调地址。不要提交真实密钥。

> 当前 OAuth Provider 强制 SPA 提交 `client_secret`。浏览器无法安全保存 secret，此方案只用于兼容现有系统；后续应迁移到 Authorization Code + PKCE。

## 上传流程

1. Web Worker 分块计算文件 MD5，并生成 Base64 `Content-MD5`。
2. 请求 `POST /api/upload/presign/upload`。
3. 若服务端返回 `skip_upload=true`，直接完成秒传。
4. 否则浏览器通过 XHR PUT 直传 OSS，并携带签名绑定的 `Content-Type`、`Content-MD5`。
5. 请求 `POST /api/upload/presign/complete`，由服务端 HeadObject 校验后写入 FileInfo。

## 阿里云 OSS CORS

Bucket 必须允许前端实际域名跨域访问：

- Allowed Origins：开发环境 `http://127.0.0.1:8084`，生产环境使用精确域名
- Allowed Methods：`PUT`、`GET`、`HEAD`
- Allowed Headers：`Content-Type`、`Content-MD5`、`Range`
- Expose Headers：`ETag`、`Content-Length`、`Content-Range`、`x-oss-request-id`

不要在生产环境把 Allowed Origins 设置为 `*`。

## 命令

```powershell
npm run test
npm run lint
npm run build
```

## 部署

镜像使用多阶段构建：在 Docker 内完成 `npm ci` 与 `npm run build`，最终只保留 Nginx 与静态资源。

本地构建可先参考 `.env.production.example`，通过 `--build-arg` 传入 OAuth 等变量：

```powershell
docker build `
  --build-arg VUE_APP_OAUTH_SERVER_URL=http://127.0.0.1:8090 `
  --build-arg VUE_APP_OAUTH_CLIENT_ID=your-client-id `
  --build-arg VUE_APP_OAUTH_CLIENT_SECRET=your-client-secret `
  --build-arg VUE_APP_OAUTH_REDIRECT_URI=http://127.0.0.1:8084/oauth/callback `
  -t openapi-file .
docker run --rm -p 8084:80 openapi-file
```

生产部署需同步配置：

- `home` API 允许 openapi_file 域名跨域
- OSS Bucket CORS
- OAuth Client 的生产回调 URI
