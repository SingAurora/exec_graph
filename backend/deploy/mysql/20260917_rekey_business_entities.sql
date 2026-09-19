-- 将业务实体从“字符串主键”迁移为“自增内部 ID + 对外 UUID”。
-- 必须在部署已兼容 uuid 查询的应用版本后执行。
-- MySQL 的 ALTER TABLE 会隐式提交，执行前必须备份数据库；本脚本不应由 API 进程自动运行。

-- 用户和验证码记录已使用自增主键，不在这里重建。
-- auth_sessions、execution_work_logs 为遗留表，后续单独清理，不纳入新主键体系。

ALTER TABLE ai_api_keys
    DROP PRIMARY KEY,
    CHANGE COLUMN id uuid VARCHAR(100) NOT NULL,
    ADD COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT FIRST,
    ADD PRIMARY KEY (id),
    ADD UNIQUE KEY uq_ai_api_keys_uuid (uuid);

ALTER TABLE smart_contracts
    DROP PRIMARY KEY,
    CHANGE COLUMN id uuid VARCHAR(100) NOT NULL,
    ADD COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT FIRST,
    ADD PRIMARY KEY (id),
    ADD UNIQUE KEY uq_smart_contracts_uuid (uuid);

ALTER TABLE projects
    DROP PRIMARY KEY,
    CHANGE COLUMN id uuid VARCHAR(100) NOT NULL,
    ADD COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT FIRST,
    ADD PRIMARY KEY (id),
    ADD UNIQUE KEY uq_projects_uuid (uuid);

ALTER TABLE project_contract_revisions
    DROP PRIMARY KEY,
    CHANGE COLUMN id uuid VARCHAR(100) NOT NULL,
    ADD COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT FIRST,
    ADD PRIMARY KEY (id),
    ADD UNIQUE KEY uq_project_contract_revisions_uuid (uuid);

ALTER TABLE execution_branches
    DROP PRIMARY KEY,
    CHANGE COLUMN id uuid VARCHAR(100) NOT NULL,
    ADD COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT FIRST,
    ADD PRIMARY KEY (id),
    ADD UNIQUE KEY uq_execution_branches_uuid (uuid);

ALTER TABLE execution_contracts
    DROP PRIMARY KEY,
    CHANGE COLUMN id uuid VARCHAR(100) NOT NULL,
    ADD COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT FIRST,
    ADD PRIMARY KEY (id),
    ADD UNIQUE KEY uq_execution_contracts_uuid (uuid);

ALTER TABLE execution_edges
    DROP PRIMARY KEY,
    CHANGE COLUMN id uuid VARCHAR(100) NOT NULL,
    ADD COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT FIRST,
    ADD PRIMARY KEY (id),
    ADD UNIQUE KEY uq_execution_edges_uuid (uuid);

ALTER TABLE node_conversations
    DROP PRIMARY KEY,
    CHANGE COLUMN id uuid VARCHAR(100) NOT NULL,
    ADD COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT FIRST,
    ADD PRIMARY KEY (id),
    ADD UNIQUE KEY uq_node_conversations_uuid (uuid);

ALTER TABLE node_conversation_messages
    DROP PRIMARY KEY,
    CHANGE COLUMN id uuid VARCHAR(100) NOT NULL,
    ADD COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT FIRST,
    ADD PRIMARY KEY (id),
    ADD UNIQUE KEY uq_node_conversation_messages_uuid (uuid);

ALTER TABLE completion_records
    DROP PRIMARY KEY,
    CHANGE COLUMN id uuid VARCHAR(100) NOT NULL,
    ADD COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT FIRST,
    ADD PRIMARY KEY (id),
    ADD UNIQUE KEY uq_completion_records_uuid (uuid);

ALTER TABLE collaboration_calls
    DROP PRIMARY KEY,
    CHANGE COLUMN id uuid VARCHAR(100) NOT NULL,
    ADD COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT FIRST,
    ADD PRIMARY KEY (id),
    ADD UNIQUE KEY uq_collaboration_calls_uuid (uuid);

ALTER TABLE collaboration_submissions
    DROP PRIMARY KEY,
    CHANGE COLUMN id uuid VARCHAR(100) NOT NULL,
    ADD COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT FIRST,
    ADD PRIMARY KEY (id),
    ADD UNIQUE KEY uq_collaboration_submissions_uuid (uuid);

ALTER TABLE collaboration_review_batches
    DROP PRIMARY KEY,
    CHANGE COLUMN id uuid VARCHAR(100) NOT NULL,
    ADD COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT FIRST,
    ADD PRIMARY KEY (id),
    ADD UNIQUE KEY uq_collaboration_review_batches_uuid (uuid);

ALTER TABLE daily_work_reviews
    DROP PRIMARY KEY,
    CHANGE COLUMN id uuid VARCHAR(100) NOT NULL,
    ADD COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT FIRST,
    ADD PRIMARY KEY (id),
    ADD UNIQUE KEY uq_daily_work_reviews_uuid (uuid);

ALTER TABLE smart_contract_events
    DROP PRIMARY KEY,
    CHANGE COLUMN id uuid VARCHAR(100) NOT NULL,
    ADD COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT FIRST,
    ADD PRIMARY KEY (id),
    ADD UNIQUE KEY uq_smart_contract_events_uuid (uuid);
