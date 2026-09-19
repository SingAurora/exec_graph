# MySQL Schema Changes

这里的 SQL 由数据库部署流程手工执行，API 启动时不会自动执行任何 schema 变更。

## `20260917_rekey_business_entities.sql`

将公开业务实体的原字符串主键迁移为 `uuid`，并新增自增 `BIGINT UNSIGNED id` 作为数据库内部主键。原有公开字符串会原样保留在 `uuid`，因此已存在的项目、节点和成果链接不会改变。

执行前应备份目标数据库，并先部署已按 `uuid` 查询的应用版本。MySQL 的 `ALTER TABLE` 会隐式提交，因此不能依赖事务回滚。该脚本仅适用于迁移前的字符串 `id` schema，不能重复执行。

## `20260917_add_schema_comments.sql`

为现存表和字段写入中文 MySQL 注释。应在结构变更完成后执行；可以重复执行。

## `20260917_internalize_relationship_ids.sql`

将所有实体关系字段改为内部 `BIGINT UNSIGNED id`，同时保留各实体的 `uuid` 作为 HTTP API 和 URL 的唯一公开标识。节点来源、完成范围和协作审查范围中的 JSON 标识也改为内部数字 ID。

该脚本还会删除不再使用的 `auth_sessions` 与 `execution_work_logs`。只能对已经执行过 `20260917_rekey_business_entities.sql` 的数据库执行一次。若部署中断，必须从脚本日志记录的下一条语句继续，而不是重新从头运行。

本地部署工具只会在显式确认后执行 SQL：

```bash
go run ./cmd/mysql-deploy -file deploy/mysql/20260917_internalize_relationship_ids.sql -apply
```

## `20260917_verify_internal_ids.sql`

只读验收脚本。预期不返回任何行，分别验证：所有关系字段均为 `BIGINT UNSIGNED`、遗留表已删除、业务实体保留 `uuid`。

## `20260917_add_internal_id_comments.sql`

在内部关系 ID 迁移后执行，为新建的数字关系字段补齐中文注释。
