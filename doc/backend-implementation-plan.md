# 后端实施计划

本文件记录逐阶段交付边界和验证证据，不以建表或 mock 成功代替真实功能可用。

## 技术与目录

使用 Go 1.23、Gin、GORM、MySQL、Redis。表间通过 UUID 逻辑关联，不建外键。业务查询和写入使用 GORM；仅数据库创建、迁移锁和数据库元信息诊断等 GORM 无法表达的管理操作可使用明确限定的 SQL。不在请求路径自动迁移。

```text
backend/
  cmd/api/                         HTTP 进程启动
  cmd/manage/                      检查依赖、迁移、导入、验证命令
  etc/                            本地配置与无密钥示例
  internal/bootstrap/             配置、依赖创建和服务装配
  internal/application/
    identity/                     登录、会话、账户 DTO 与端口
    catalogue/                    当前前端的目录及行动上下文读取
    demoseed/                     演示导入输入校验与数据转换
    graph/                        图管理与删除规则（后续阶段）
    action/                       行动发布与文档确认（后续阶段）
    profile/                      资料与精选（后续阶段）
    generation/                   AI 生成与确认边界（后续阶段）
  internal/infrastructure/
    persistence/model/            GORM 模型，只有 UUID 逻辑关联
    persistence/schema/           有版本记录的 Go/GORM 迁移
    persistence/identity/          账户仓储
    persistence/catalogue/         目录与上下文读取仓储
    persistence/demoseed/          演示数据事务导入
    session/                      Redis 会话与限流
    security/                     密码哈希、随机令牌
    mail/                         邮件客户端（后续阶段）
    storage/                      对象存储客户端（后续阶段）
    ai/                           平台 AI 客户端（后续阶段）
  internal/http/
    router/                       唯一的 URL、方法和分组定义
    endpoint/                     参数绑定及用例适配
    middleware/                   会话、CSRF、错误、请求追踪
    endpoint/common/              JSON、认证上下文及响应适配
  internal/shared/                无业务归属的常量、错误和 UUID
  scripts/export-demo.ts          显式导出现有前端演示内容与图片
  internal/infrastructure/persistence/demoseed/testdata/
                                  编译内嵌的版本化测试夹具
```

application 不依赖 Gin、GORM 或配置包；bootstrap 创建并注入所有外部客户端。旧代码仅参考外部依赖调用方式，不恢复旧计划、协作、个人 AI Key 等产品模型。

## 阶段与验收

| 阶段 | 交付 | 完成条件 |
| --- | --- | --- |
| 1 | 配置兼容、连接、GORM 模型及版本迁移 | 真实 MySQL 有表、无外键、唯一键和 CHECK 有效；测试账号标记可持久化；拒绝接管旧表 |
| 2 | 演示导入、登录／退出、Redis 会话、CSRF、目录／上下文读取 | 所有演示用户有数据库标记；重复导入不覆盖已有数据；HTTP 登录、读取、退出失效；UUID 映射、继承／清空、形成过程和配图保留 |
| 3 | 图、行动、表达、约定、资料、关注、精选写入 | 实库验证事务、版本冲突、幂等重放、跨图／越权拒绝、终点编辑及五个精选；刷新仍存在 |
| 4 | 邮件认证、对象存储、平台 AI 生成、完整前端联调 | 真实依赖可用；浏览器注册／登录、上传、生成、发布和回应走通；关闭 MSW 后无需演示数据回退 |

前两阶段作为第一批可独立运行的交付；其余阶段必须保持待办，不将尚未实现的端点伪装成成功。每阶段补充实际执行命令和结果。

## 演示与旧库

- `backend/etc/config.local.yaml` 作为旧配置输入保留，不输出或提交凭据。通过环境变量选择新 schema，避免对旧库直接迁移。
- 显式管理命令使用 GORM Migrator；迁移状态记录到 schema_versions，业务进程只校验版本。已存在未受本迁移管理的同名业务表时拒绝接管。
- 导入读取当前前端演示导出文件，按固定命名空间将短 ID 映射成 UUID；保存 alias 对照用于旧链接兼容。示例内容不在服务启动时自动重新写入。
- 所有演示作者都建立为带 `is_test_account = true` 的测试用户，不将林岚等示例作者冒充真实用户，也不将所有行动错误归给同一作者。测试数据集另记导入标识。
- 测试号也经过服务端会话。演示登录仅允许显式启用的开发模式及指定测试账号，生产默认关闭；公开资料不暴露邮箱或测试管理字段。
- 集成验证使用独立 schema 和独立 Redis 键前缀，不清空配置里的 Redis，也不修改旧库。测试清理只针对本次明确创建的资源。

## 当前证据

### 阶段 1：完成

- 2026-10-26 使用旧本地配置成功连接真实 MySQL 与 Redis，没有修改配置文件或旧 schema。
- 在独立 `exec_graph_v1` schema 执行 GORM 迁移，创建 20 张业务表和 3 张管理表；API 不自动迁移。
- 实库集成测试每次创建随机隔离库，完成后清除。验证首次／重复迁移、版本记录、UUID 唯一、起点唯一、主要来源唯一、合入允许、精选上限、测试账号标记、无外键及旧表保护。
- `EXEC_GRAPH_CONFIG=<本地配置绝对路径> EXEC_GRAPH_INTEGRATION=1 go test ./...` 通过；`go vet ./...`、`gofmt` 和 `git diff --check` 通过。
- 初次实库迁移发现并修复 GORM Connection 回调内的语句状态复用，随机新库重跑通过。

### 阶段 2：完成

- 从当前前端导入 7 位测试作者、9 张图、37 条行动、7 张本地配图；全部用户带数据库测试标记。使用稳定 UUID 并保存旧链接 alias，原作者、确认形成过程、主要来源、合入、主动清空和 5 个精选得到保留。
- 导入标记与业务数据同事务提交。同内容重复导入不覆盖已有昵称和密码，内容变化拒绝静默覆盖；演示 AI 记录明确使用 `demo-fixture` 标记。
- 已在真实 MySQL／Redis 上通过随机隔离库 HTTP 集成测试，覆盖密码登录、受控测试号登录、cookie 策略、CSRF、退出失效、认证版本撤销、UUID 映射、公开资料隐私、确认形成过程、未确认消息隔离及图片读取。
- 单元测试覆盖主要来源继承、主动清空后继续继承、约定未知状态、跨图引用拒绝、例外理由校验、确定 UUID 及不修改原始夹具。
- 在 `exec_graph_v1` 持久库独立启动 API，再通过实际 HTTP 验证健康检查、登录、公开 7 位用户、9 张图／37 条行动、5 个精选、CORS 和退出撤销，全部通过；验证后停止临时 API 进程。
- `EXEC_GRAPH_CONFIG=<本地配置绝对路径> EXEC_GRAPH_INTEGRATION=1 go test ./...`、`go test ./...`、`go vet ./...` 通过。启动、导入和接口清单见 `backend/README.md`。

阶段 3～4 尚未完成：当前没有业务写入、注册邮件、上传和真实 AI 生成接口，前端也尚未切换到真实后端。现有读取 DTO 使用 `graphId`／`graphIds`，前端 `projectId`／`projectIds` 的兼容适配留到联调阶段明确处理。
