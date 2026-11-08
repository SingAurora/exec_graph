# 前端开发

```sh
bun install
bun run dev
```

从仓库根目录运行 `./dev.sh` 可以同时启动 Go API 和 Vite；也可以分别启动。默认后端监听 `127.0.0.1:8080`，前端在 `http://localhost:5173`，Vite 会把浏览器发出的 `/api/...` 请求代理到后端 8080。后端使用其他端口时，通过 `API_PROXY_TARGET` 指定代理目标。部署时运行 `bun run build`，让 Go 通过 `EXEC_GRAPH_FRONTEND_DIR` 提供生成的 `dist`，页面与 API 共用一个端口，`VITE_API_BASE_URL` 留空，不再运行 Vite。完整命令见 [Go 同时提供前端与 API](../backend/README.md#go-同时提供前端与-api)。平台密钥只配置在后端。开发测试号入口需同时开启前端 `VITE_ENABLE_DEMO_LOGIN=true` 和后端 `EXEC_GRAPH_ENABLE_DEMO_LOGIN=true`。

## 请求与缓存

- `src/shared/api/client.ts`：业务 `getAPI`／`postAPI`／`postFormAPI`，统一 JSON 外壳、超时、取消、Bearer 认证、结构化错误；`getBlob` 下载图片。
- `src/entities/*/api`：领域读取、DTO、query key；`src/features/*/api`：明确的写入用例。
- `src/app/model/useAppResources.ts`：读取装配；`useAppCommands.ts`：写入及成功后的缓存更新；`src/app/providers/query-client.ts`：应用级缓存策略。

读取缓存有效期 30 秒、无订阅保留 10 分钟；窗口重新聚焦不自动刷新。暂时性读取失败最多重试一次，写入不自动重试。创建支持幂等键，更新支持版本冲突；表单和本地草稿在失败时保留，确认成功后才提示保存或清理草稿。

目前用目录和完整图上下文承接既有选择器；列表无限滚动及搜索分页仍在完整数据上计算。规模增长前应迁移到摘要流、远端搜索分页和按需详情。完整规范见 [请求契约](../doc/api-request-contract.md)。

## 联调

前端只连接真实后端，不提供模拟接口或模拟数据回退。不同源部署可配置 `VITE_API_BASE_URL`，并正确配置后端 CORS。`VITE_` 环境变量会暴露给浏览器，不要填写账户或 API 密钥。接口不可用时显示错误，保留输入和草稿。

支持邮箱登录、验证码注册／重置、注销和账户安全。401 统一切换为匿名并清除旧账号查询，其他错误保留重试。登录使用 Bearer token，前端保存在浏览器本地存储；不使用 Cookie。注销不删除按账号隔离的本地草稿。

## 平台 AI

行动和表达使用后端平台默认模型，不提供个人密钥或模型切换。前端调用 `/api/commands/ai/generate`，只传本轮输入及引用选择；历史事实与私有对话由后端读取。返回的 `generationId` 和确认 DTO 随草稿保存，发布时确认服务端结果。响应丢失后用原提交键重试；离开工作区取消等待，服务端仍会结束已接受的生成。

资料图片裁剪后点击保存才上传；行动配图上传后登记资产 UUID，恢复草稿时续期七天。业务保存失败保留草稿；未引用图片由后端回收，见 [外部能力契约](../doc/backend-external-contract.md)。旧短 ID 链接通过后端显式 `legacyId` 映射；导入账号的旧草稿键保留，旧生成不能直接发布，需重新对话。

## 验证

```sh
bun run lint
npm exec --yes --package=bun@1.4.4 -- bun run test
bun run build
```

建议 Bun 1.4.4 或更新版本。统一客户端测试覆盖 multipart、匿名会话、超时和取消；Query 测试覆盖缓存与认证失效；领域测试覆盖生成确认、幂等、版本冲突、权限及继承／清空。

浏览器可在 Network 中按 `/api/commands/` 筛选请求。断网或让服务返回 503 时，输入和表单应保留，恢复后可重试。
