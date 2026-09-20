# Exec Graph 开发规范

本文件是本仓库的项目级开发约定。修改代码前先阅读相关领域的现有实现，保持接口行为和数据兼容；不要回退无关的工作区改动。

## 结构与职责

- `backend/cmd` 只保留进程启动入口。
- `backend/internal/bootstrap` 是组合根：读取配置、创建 GORM/Redis/外部客户端、仓储、application service 和 HTTP server。其他层不得自行创建这些依赖。
- `backend/internal/application/<domain>` 实现用例、业务规则、事务边界和领域 DTO；不得依赖 `net/http`、Gin 或具体前端响应结构。
- `backend/internal/infrastructure` 实现数据库、Redis、邮件、对象存储和 AI 等外部能力。SQL、GORM 查询和基础设施配置只在这里出现。
- `backend/internal/http/endpoint/<domain>` 只做 HTTP 适配：绑定请求、提取认证用户、调用 application service、映射错误和写响应。不得直接发起 SQL、管理事务或组装基础设施。
- `backend/internal/http/router` 是路径、HTTP 方法、路由分组的唯一所有者；每条路由上方使用中文注释说明业务功能。
- `backend/internal/http/request`、`response`、`middleware`、`endpoint/common` 放跨 endpoint 的 HTTP 通用能力，不放领域业务。
- `backend/internal/shared` 仅放无业务归属、可被多层复用的纯能力，例如常量、ID 和错误类型；不要把业务模型或数据库访问放入这里。

## 文件与命名

- 目录按领域拆分，不按技术名堆放。一个文件只围绕一个明确职责或用例组。
- 当文件超过约 300 行且包含多个独立用例时，优先按用例或子领域拆分；超过 500 行必须说明为何不能拆分。不要为了行数机械拆开同一事务流程。
- 请求和响应结构体放在所属领域的 `dto.go` 或紧邻 handler 的专用 DTO 文件；名称表达业务，例如 `CreateProjectInput`、`ProjectView`，避免 `Data`、`Result`、`Payload` 等泛化名称。
- 不用 `map[string]any` 承载稳定的业务输入、输出或持久化模型；仅用于确实动态的 JSON 内容。
- 导出类型、函数和包必须有准确注释。路由与面向用户的错误文案使用中文；代码标识符、包名和数据库字段保持英文。

## HTTP 与接口

- API 仅使用 `GET` 和 `POST`。读取使用 `GET`，筛选参数放 query；会改变状态的操作使用 `POST`，参数放 JSON。文件上传可使用 `multipart/form-data`。
- 路径采用 `/api/commands/<领域>/<动作>`，不使用通配路径、路径参数、`PATCH` 或 `DELETE`。路由不自行校验 HTTP Method，Gin 路由定义是唯一方法约束。
- 所有 JSON 返回使用统一顶层结构：`{"code": 0, "msg": "", "data": ...}`；错误由顶层错误边界转换，不在每个 handler 重复写 HTTP 错误响应。
- endpoint 使用 `endpoint/common` 解析 JSON 和写响应；不要重复实现 `decodeJSON`、鉴权解析或响应包装。

## 数据、错误与配置

- 数据库内部主键由 MySQL 自增；对外暴露资源使用稳定 UUID。不要把自增 ID 泄露到 API。
- SQL/GORM 只在 persistence 仓储中。application 层依赖仓储接口或领域仓储，不依赖 `*gorm.DB`。
- 业务可预期错误使用 `internal/shared/fault` 或 application 领域错误表达，由 HTTP 顶层统一映射 `code` 和 `msg`；基础设施错误必须带上下文后上抛，不得静默吞掉。
- 超时、分页上限、文件大小、重试次数等可复用固定值放入 `internal/shared/constants`，不在业务函数中写魔法数字。
- 配置用中性能力名称，例如 `objectStorage`、`database`；不要将某个云厂商名称写进通用配置结构或业务逻辑。

## 前端

- 所有 HTTP 请求通过 `frontend/src/lib/api.ts`，不在页面、组件或 store 中直接调用 `fetch`。
- store 只保存会话和 UI 状态；工作区、项目、节点等服务端事实必须由 API 刷新。不得加入运行时假数据、离线写入或持久化明文密码。
- 保持前端类型与后端公开 DTO 的字段语义一致。修改 API 时同步检查调用点。

## 验证

- 后端改动至少运行：`cd backend && gofmt -w <改动文件> && go test ./... && go vet ./...`。
- 前端改动至少运行：`cd frontend && bun run lint && bun run build`。
- 提交前运行 `git diff --check`。涉及接口、权限、事务或状态流时补充针对该行为的测试。
