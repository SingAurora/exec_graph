# exec_graph backend

当前后端使用 Gin、MySQL、Redis、邮件和对象存储基础设施。

## 目录职责

- `cmd/api/main.go`：HTTP 服务启动入口
- `internal/bootstrap/application`：应用依赖组装和 HTTP 服务启动
- `internal/application/identity`：账户、验证码、登录会话和凭据变更用例
- `internal/application/project`：项目生命周期、规则模板、推进节点和完成记录用例
- `internal/application/collaboration`：开放缺口、公开探索项目和成果投稿用例
- `internal/application/aikey`：AI 服务配置、验证和删除用例
- `internal/http/router`：HTTP 路径和方法映射
- `internal/http/endpoint`：按领域拆分的请求绑定、当前用户提取、用例调用和 HTTP 响应映射；不承载数据库事务
- `internal/http/request`：公共请求解析与请求级基础校验
- `internal/http/response`：统一 JSON 成功与错误响应
- `internal/http/middleware`：HTTP 中间件
- `internal/infrastructure/mysql`、`internal/infrastructure/redis`：MySQL 与 Redis 基础设施
- `internal/infrastructure/mail`、`internal/infrastructure/storage`：邮件与对象存储基础设施
- `etc/config.example.yaml`：配置字段说明与示例
- `etc/config.local.yaml`：仅本地使用的实际配置，已被 Git 忽略

从 `backend` 目录启动。先根据 `etc/config.example.yaml` 创建 `etc/config.local.yaml`。数据库结构与必要系统数据由外部部署流程管理，API 不会修改它们：

```bash
go run ./cmd/api
```

## API 基础约定

登录或注册返回 `accessToken`，后续需要登录的请求使用：

```http
Authorization: Bearer <accessToken>
```

接口使用明确的 `/api/commands/<领域>/<操作>` 命名，但 HTTP 方法遵循操作性质：不改变状态的读取使用 `GET`，参数放在 query；创建、更新、审查和其它状态变更使用 `POST`，参数放在 JSON 请求体。接口不使用路径参数、`PATCH` 或 `DELETE`。例如：

- `GET /api/health`
- `POST /api/commands/auth/login-with-password`
- `GET /api/commands/users/get-current-user-profile`
- `POST /api/commands/users/update-current-user-profile`
- `GET /api/commands/projects/list-owned-projects`
- `GET /api/commands/projects/get-project-detail?projectUuid=...`
- `GET /api/commands/projects/get-project-execution-graph?projectUuid=...`
- `POST /api/commands/projects/create-execution-node`，请求体包含 `projectUuid` 和节点草案
- `POST /api/commands/projects/confirm-node-completion`，请求体：`{"projectUuid":"...","nodeUuid":"..."}`
- `GET /api/commands/contracts/list-available-smart-contracts`
- `POST /api/commands/ai-keys/verify-saved-ai-key`，请求体：`{"keyUuid":"..."}`
- `POST /api/commands/conversations/send-conversation-message`，请求体：`{"conversationUuid":"...","body":"..."}`

上传头像和背景图仍使用命令路径与 `POST`，但请求体为 `multipart/form-data`，不是 JSON。

节点草案审核、创建节点、提交完成审查、用户确认锁定和完成记录均会写入 MySQL。节点图接口会返回项目、路径、节点关系和完成记录，用于恢复同一条推进链。

头像使用 COS 私有对象：数据库保存对象键，接口返回有效期 24 小时的签名访问链接。

开发期的账号密码和 AI 密钥按用户隔离，以明文保存在数据库中；AI 密钥接口可直接返回原始密钥，方便本地调试。

Redis 连接配置在 `redis` 段。Redis 是唯一登录会话来源：Redis 未配置、无法连接或运行中不可用时，API 不会回退到 MySQL 会话。
## 凭据部署

部署包含密码哈希或 AI 密钥加密的版本前，先配置
`security.credential_encryption_key`，停写后执行一次：

```bash
go run ./cmd/credential-migrate -apply
```

命令会在一个事务中把旧密码转换为 bcrypt，把旧 AI 密钥转换为
AES-256-GCM 密文，并在提交前验证所有凭据。API 运行时不兼容明文凭据。
