# 前端开发

```sh
bun install
bun run dev --port 5174
```

开发模式默认由 `.env.development` 显式启用 `VITE_ENABLE_API_MOCKS=true`。应用先启动 MSW，再渲染 Query Provider；页面通过真实 HTTP 请求读取演示数据，模拟服务器只存在于本次页面会话。刷新会重置演示写入，本地自动保存草稿保持原有独立生命周期。MSW 使用 2.x，与当前 Bun 测试环境兼容。

## 请求与缓存

- `src/shared/api/client.ts`：业务 `getAPI`／`postAPI`，统一 JSON 外壳、超时、取消、CSRF、结构化错误。现有 AI 代理与图片下载仍用独立的 `postJSON`／`getBlob`。
- `src/entities/*/api`：领域读取、DTO、query key；`src/features/*/api`：明确的写入用例。
- `src/app/model/useAppResources.ts`：读取装配；`useAppCommands.ts`：写入及成功后的缓存更新；`src/app/providers/query-client.ts`：应用级缓存策略。
- `src/app/mocks`：模拟服务器及校验；固定演示种子仅从 `src/app/demo` 注入，不用作真实请求失败后的回退。

读取缓存有效期 30 秒、无订阅保留 10 分钟；窗口重新聚焦不自动刷新。暂时性读取失败最多重试一次，写入不自动重试。创建支持幂等键，更新支持版本冲突；表单和本地草稿在失败时保留，确认成功后才提示保存或清理草稿。

目前用目录和完整图上下文承接既有选择器；列表无限滚动及搜索分页仍为完整数据上的原型交互。正式后端接入前应迁移到摘要流、远端搜索分页和按需详情，不能把此过渡接口当成最终大数据接口。完整规范见 [请求契约](../doc/api-request-contract.md)。

## 关闭模拟与联调

在 `.env.development.local` 设置 `VITE_ENABLE_API_MOCKS=false`；如后端不同源，同时设置 `VITE_API_BASE_URL=https://你的后端域名`，重启 Vite。环境变量中不要填写账户或 API 密钥。关闭模拟后请求必须由真实后端响应；不可用时显示加载错误和重试入口，不会自动恢复演示数据。

MSW 仅在开发构建且开关为 true 时启动。未声明的 `/api/commands/` 请求报错，图片和 AI 代理请求放行。生产构建不会打包模拟 handlers／演示种子或启动 worker；`public/mockServiceWorker.js` 作为静态文件可能被复制，单有文件不会启用模拟。

当前登录／账户安全仍为静态演示，并未实现真实服务端认证。接口模拟默认使用已登录的演示账号；接入正式后端时须补全认证用例及 401 导航。

## 验证

```sh
bun run lint
bun run test
bun run build
```

`src/app/mocks/api.test.mjs` 直接通过统一客户端和 MSW 验证读写、幂等、版本冲突、权限及文档继承／清空。`business-client.test.mjs` 验证错误外壳、超时和取消；Query 测试验证去重、缓存隔离与重试策略。

浏览器可在 Network 中按 `/api/commands/` 筛选请求。调试保存失败时，可临时让对应 handler 返回契约中的 503 错误；输入和表单应保留，恢复成功响应后可重试。MSW 能离线响应，浏览器的 Offline 开关不能可靠地模拟此类业务请求失败。关闭模拟并重启开发服务后，应出现明确的加载失败而非旧演示内容。当前 AI 对话仍需既有的 AI 代理配置；MSW 不会替它生成回复。
