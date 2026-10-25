# 引序后端

Go + Gin + GORM + MySQL + Redis。阶段安排和验收见 [实施计划](../doc/backend-implementation-plan.md)。

## 配置与管理

在 backend 目录运行，默认读取 `etc/config.local.yaml`。该文件包含旧项目凭据，已加入 gitignore；新能力通过无密钥示例和环境变量配置，不覆盖本地文件。

```sh
go run ./cmd/manage check
EXEC_GRAPH_DATABASE_SCHEMA=exec_graph_v1 go run ./cmd/manage migrate --create-database
EXEC_GRAPH_DATABASE_SCHEMA=exec_graph_v1 go run ./cmd/manage verify
```

`migrate` 是显式、有版本记录的 Go/GORM 迁移。首次迁移创建空表，已有未受此迁移管理的同名业务表时拒绝接管。API 进程只校验版本，禁止启动时自动修改数据库。

数据库关联全部使用 UUID 标量，不声明 GORM association，连接同时设置 `DisableForeignKeyConstraintWhenMigrating: true`。自增 id 仅用于表内主键及内部遍历。

仅数据库创建与迁移管理锁使用 GORM 无法直接表达的 MySQL 管理语句；业务和表结构均通过 GORM。禁止对旧库直接套用新的结构。

可用环境变量：`EXEC_GRAPH_CONFIG`、`EXEC_GRAPH_DATABASE_SCHEMA`、`EXEC_GRAPH_REDIS_PREFIX`、`EXEC_GRAPH_ADDR`、`EXEC_GRAPH_ENV`、`EXEC_GRAPH_ENABLE_DEMO_LOGIN`、`EXEC_GRAPH_ALLOWED_ORIGINS`（逗号分隔的精确 Origin）。生产环境禁止演示登录，默认不开启。

## 导入与启动

```sh
EXEC_GRAPH_DATABASE_SCHEMA=exec_graph_v1 go run ./cmd/manage seed-demo
EXEC_GRAPH_DATABASE_SCHEMA=exec_graph_v1 EXEC_GRAPH_ADDR=127.0.0.1:8081 EXEC_GRAPH_ENABLE_DEMO_LOGIN=true EXEC_GRAPH_ALLOWED_ORIGINS=http://localhost:5174 go run ./cmd/api
```

导入当前前端的 7 位演示作者、9 张图、37 条行动和 7 张本地图片。每位作者都有 `users.is_test_account = true`、`test_dataset = frontend-demo-v1` 数据库标记。精选保留 5 个表达，约定沿主要来源继承。合入来源仅提供事实背景，主动清空不会变回继承。

导入使用稳定 UUID，保留原作者和旧链接 alias。数据集标记和全部业务记录同事务提交；重复执行不会覆盖昵称、密码、精选等后续修改，导出内容改变后也不会静默覆盖。演示形成过程明确标记为 `demo-fixture`，不冒充真实 AI 调用。

默认给测试号生成未知随机密码。需要验证密码登录时，在**首次导入前**通过 `EXEC_GRAPH_DEMO_PASSWORD` 设置主测试号 `qiao@example.com` 的密码；不要写进源码或命令历史。已导入数据不会因再次设置环境变量而重置密码。开发环境可使用 `/auth/demo-login` 登录固定的乔账号，不接受任意用户 ID。

后端已嵌入导出夹具，启动和导入均不依赖前端源码。只有明确更新测试夹具时，才在仓库根目录运行 `bun backend/scripts/export-demo.ts`；导出后的 JSON 和图片需一并审查。夹具变化需要新的导入版本和显式迁移方案，不要直接删除已使用的数据集标记。

## 已实现接口

以下路径均以 `/api/commands` 开头；JSON 响应统一使用 `{code, msg, data}`。

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/system/health` | 检查真实 MySQL、Redis 就绪状态 |
| POST | `/auth/login` | 邮箱密码登录，JSON 为 `email`、`password` |
| POST | `/auth/demo-login` | 显式开发模式登录固定测试号，JSON 为 `{}` |
| GET | `/auth/session` | 当前账户及 CSRF token |
| POST | `/auth/logout` | JSON 为 `{}`，需 `X-CSRF-Token` |
| GET | `/profiles/catalogue` | 公开用户资料，不含邮箱和测试管理字段 |
| GET | `/graphs/catalogue` | 可见图目录 |
| GET | `/graphs/detail?graphId=...` | 单图资料 |
| GET | `/actions/context?graphId=...` | 图内完整确认上下文 |
| GET | `/actions/detail?nodeId=...` | 单个行动 |
| GET | `/following/sources` | 当前登录账号的关注集合 |
| GET | `/media/file?assetId=...` | 已就绪图片；成功时返回二进制，不套 JSON |

使用 HttpOnly cookie 和 Redis 会话；客户端需携带 cookie。每次会话读取检查数据库停用状态及认证版本。密码采用 Argon2id，不提供明文或可逆密码读取。

读取兼容导入数据的旧短 ID，但响应资源 ID 一律为 UUID。行动 DTO 使用 `graphId`，关注 DTO 使用 `graphIds`；前端当前仍使用 `projectId`／`projectIds`，须在后续联调阶段统一适配，不能直接关闭 MSW 当作已完成接入。未确认的 AI 对话不会公开。

**当前交付止于读取和会话**：注册、验证码、密码重置、图和行动写入、上传及真实 AI 生成尚未实现；前端仍为静态原型。未知接口返回 404，不返回模拟成功。

## 验证

```sh
go test ./...
go vet ./...
EXEC_GRAPH_CONFIG=/absolute/path/to/config.local.yaml EXEC_GRAPH_INTEGRATION=1 go test ./...
```

`manage check` 探测真实 MySQL 与 Redis。`manage verify` 检查实际 schema、模型表及无外键约定。真实外部服务不可达时返回失败，不使用内存数据库代替。

实库测试创建随机 MySQL schema 和独立 Redis 前缀，测试结束删除自己的 schema，不清空旧库或共享 Redis。覆盖 GORM 迁移、约束、测试号导入、重复导入、真实 HTTP 登录／读取／退出、公开字段隔离、图片、未确认消息隔离及会话撤销。未设置 `EXEC_GRAPH_INTEGRATION=1` 时，这些外部依赖测试明确跳过。
