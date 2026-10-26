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
| POST | `/auth/code-send`、`/auth/register`、`/auth/password-reset` | 邮件验证码、注册及找回密码 |
| POST | `/auth/password-change`、`/auth/email-change` | 当前密码与验证码双重校验，成功撤销旧会话 |
| GET | `/profiles/catalogue` | 公开用户资料，不含邮箱和测试管理字段 |
| GET | `/graphs/catalogue` | 可见图目录 |
| GET | `/graphs/detail?graphId=...` | 单图资料 |
| GET | `/actions/context?graphId=...` | 图内完整确认上下文 |
| GET | `/actions/detail?nodeId=...` | 单个行动 |
| GET | `/following/sources` | 当前登录账号的关注集合 |
| GET | `/media/file?assetId=...` | 已就绪图片；成功时返回二进制，不套 JSON |
| POST | `/media/upload`、`/media/retain` | 上传登记与草稿图片续期 |
| POST | `/ai/generate` | 平台 AI 生成私有草稿，需要提交键 |
| GET | `/ai/generation?generationId=...` | 读取本人生成结果及确认参数 |
| POST | `/graphs/create`、`/graphs/update`、`/graphs/delete` | 图创建、版本更新和受保护删除 |
| POST | `/actions/create` | 确认服务端 AI 结果并原子发布行动 |
| POST | `/expressions/update`、`/agreements/update` | 终点表达／约定的版本化确认 |
| POST | `/profiles/update`、`/profiles/highlights-set` | 公开资料、最多五个表达精选及顺序 |
| POST | `/following/set` | 显式设置用户／图关注状态 |

使用 HttpOnly cookie 和 Redis 会话；客户端需携带 cookie。每次会话读取检查数据库停用状态及认证版本。密码采用 Argon2id，不提供明文或可逆密码读取。

读取兼容导入数据的旧短 ID，但响应资源 ID 一律为 UUID；写入只接受 UUID。行动 DTO 使用 `graphId`，前端已显式映射为 UI 的 `projectId`；关注模型已使用 `graphIds`。未确认的 AI 对话不会公开。

写入的准确 DTO、权限和事务行为见 [真实后端写入契约](../doc/backend-write-contract.md)。创建带 `Idempotency-Key`，全部业务写入带 CSRF，修改带 `expectedVersion`。图和资料图片接受已上传的资产 UUID；行动及表达确认使用 `generationId`，不接受浏览器直接伪造的 AI 文稿／对话。

前端默认关闭 MSW，真实认证、上传、生成和确认发布已接入。外部能力 DTO、私有草稿隔离、限时和回收边界见 [外部能力契约](../doc/backend-external-contract.md)。未知接口返回 404，不返回模拟成功。

## 外部能力配置

参考 `etc/config.example.yaml`。真实邮件需 `mail.enabled`、发件地址、模板 ID、区域及服务端凭据；真实图片需 `storage.enabled`、bucket、region 和专用 `media_prefix`。旧配置的凭据仅由 bootstrap 创建 SDK 时读取，不进入业务用例。平台 AI 配置 `ai.base_url`、`ai.model`、`ai.api_key`，也可通过 `DEEPSEEK_API_KEY` 注入密钥，示例模型为 `deepseek-flash`。不要把真实配置提交到 Git。

第四阶段 schema v2 增加图片保留登记表，已有 v1 数据执行同一 `manage migrate` 升级，保留原用户和业务身份。上传未保存的图片一天后可回收；本地草稿续期七天，公开或历史引用仍受保护。API 启动时及每小时扫描一批，也可运行：

```sh
EXEC_GRAPH_DATABASE_SCHEMA=exec_graph_v1 go run ./cmd/manage prune-media
```

浏览器启动命令见 [前端说明](../frontend/README.md)。开发测试号入口需要前后端分别显式开启，不能在生产环境开启。

## 账号资源限额

`etc/config.example.yaml` 的 `limits` 展示完整配置；本地配置没有这些字段时自动使用默认值。AI 每账号每日 100 次、滚动一分钟 10 次、同时在途 2 次；图片每日 100 次、滚动一分钟 20 次，受管上传总容量 512 MiB。所有值必须为正整数，修改后重启 API；每日按 UTC 自然日（北京时间 08:00）切换。

在数据库账号锁内检查用量并登记请求，多实例共用额度；超限返回 429／10006。失败尝试也计次数，AI 同键重放不再计数；图片只有云端删除并在数据库确认后才释放容量，删除不返还当日次数，草稿续期不额外计费。演示导入不计真实调用／上传用量。计数复用现有幂等登记及资产生命周期记录，本阶段没有新增表或迁移，当前仍为 schema v2。

详细口径及边界见 [外部能力契约](../doc/backend-external-contract.md#账号限流与用量配额)。这不是平台总费用预算或按 token 计费系统；下一步仍需处理远端列表分页和移动端适配。

## 验证

```sh
go test ./...
go vet ./...
EXEC_GRAPH_CONFIG=/absolute/path/to/config.local.yaml EXEC_GRAPH_INTEGRATION=1 go test -timeout 30m ./...
```

`manage check` 探测真实 MySQL 与 Redis。`manage verify` 检查实际 schema、模型表及无外键约定。真实外部服务不可达时返回失败，不使用内存数据库代替。

实库测试创建随机 MySQL schema 和独立 Redis 前缀，测试结束删除自己的 schema，不清空旧库或共享 Redis。覆盖 GORM 迁移、约束、测试号导入、重复导入、真实 HTTP 登录／读取／退出、公开字段隔离、图片、未确认消息隔离及会话撤销，以及业务写入的权限、幂等、版本、继承／清空、精选、失败回滚和并发竞争。未设置 `EXEC_GRAPH_INTEGRATION=1` 时，这些外部依赖测试明确跳过。

云端验收另显式设置 `EXEC_GRAPH_STORAGE_INTEGRATION=1`、`EXEC_GRAPH_AI_INTEGRATION=1` 或 `EXEC_GRAPH_MAIL_INTEGRATION=1`；邮件还需 `EXEC_GRAPH_MAIL_TEST_RECIPIENT` 指定获授权的收件地址。它们会产生真实外部调用，普通实库回归不重复发送邮件或调用付费模型。测试替身只验证协议及事务，不当作云端可用性证据。
