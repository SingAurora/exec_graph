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

可用环境变量：`EXEC_GRAPH_CONFIG`、`EXEC_GRAPH_DATABASE_SCHEMA`、`EXEC_GRAPH_REDIS_PREFIX`、`EXEC_GRAPH_ADDR`、`EXEC_GRAPH_ENV`、`EXEC_GRAPH_ENABLE_DEMO_LOGIN`。生产环境禁止演示登录，默认不开启。

## 验证

```sh
go test ./...
go vet ./...
```

`manage check` 探测真实 MySQL 与 Redis。`manage verify` 检查实际 schema、模型表及无外键约定。真实外部服务不可达时返回失败，不使用内存数据库代替。
