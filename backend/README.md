# exec_graph backend

当前后端使用 Gin、MySQL、Redis 和腾讯云 SES/COS。前端可逐步从模拟数据迁移到 API。

## 目录职责

- `cmd/api/main.go`：唯一启动入口
- `internal/app/app.go`：应用依赖组装、迁移和 HTTP 服务启动
- `internal/app/auth.go`：Gin 路由、中间件、邮箱验证码注册
- `internal/app/*_handler.go`：认证、用户、头像、项目、智能合约和 AI Key API
- `internal/app/database.go`、`redis_store.go`：MySQL 与 Redis 会话缓存
- `internal/app/mailer.go`、`storage.go`：腾讯云 SES 与 COS
- `config.local.yaml`：仅本地使用的配置，已被 Git 忽略

从 `backend` 目录启动：

```bash
go run ./cmd/api
```

## API 基础约定

登录或注册返回 `accessToken`，后续需要登录的请求使用：

```http
Authorization: Bearer <accessToken>
```

当前已提供：

- `GET /api/health`
- `POST /api/auth/send-code`，`purpose` 支持 `register`、`change_email`、`change_password`、`reset_password`，共用当前腾讯云 SES 模板
- `POST /api/auth/register`
- `POST /api/auth/change-email`
- `POST /api/auth/change-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/users/me`
- `POST|DELETE /api/users/me/avatar`
- `GET|POST /api/ai-keys`
- `POST /api/ai-keys/:id/default`
- `POST /api/ai-keys/:id/verify`
- `DELETE /api/ai-keys/:id`
- `GET|POST /api/projects`
- `GET /api/projects/:id`
- `GET /api/projects/:id/graph`
- `POST /api/projects/:id/archive`
- `GET|POST /api/smart-contracts`
- `GET /api/smart-contracts/:id`

节点创建、AI 审查、用户确认和完成记录写入会在这组基础接口稳定后继续接入。

头像使用 COS 私有对象：数据库保存对象键，接口返回有效期 24 小时的签名访问链接。

开发期的账号密码和 AI 密钥按用户隔离，以明文保存在数据库中；AI 密钥接口可直接返回原始密钥，方便本地调试。

Redis 连接配置在 `redis` 段。MySQL 仍保存会话真值；Redis 缓存登录用户信息，用于减少每次鉴权的数据库查询。Redis 不可用时，后端会记录日志并继续使用 MySQL。
