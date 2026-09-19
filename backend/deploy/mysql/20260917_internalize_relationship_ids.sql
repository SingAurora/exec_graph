-- 将所有实体间关系从对外 UUID 改为内部 BIGINT UNSIGNED ID。
--
-- 前置条件：
-- 1. 应用代码已切换为“入口按 uuid 查找、关系列按 id 读写”的版本。
-- 2. 已完成完整备份，并在备份库演练成功。
-- 3. MySQL 8.0+（JSON_TABLE 用于转换 JSON 内的节点/投稿 ID）。
--
-- 本文件刻意不由 API 自动执行。ALTER TABLE 会隐式提交，执行中断必须从备份恢复。
-- 旧 UUID 仅保留在每个实体的 uuid 列，所有 *_id 关系列最终均为内部数字 ID。

-- 第一阶段：保留旧值并创建内部数字列。
ALTER TABLE projects
    CHANGE default_ai_key_id default_ai_key_uuid VARCHAR(100) NULL,
    CHANGE contribution_call_id contribution_call_uuid VARCHAR(100) NULL,
    CHANGE current_contract_id current_contract_uuid VARCHAR(100) NULL,
    CHANGE active_contract_revision_id active_contract_revision_uuid VARCHAR(100) NULL,
    ADD default_ai_key_id BIGINT UNSIGNED NULL,
    ADD contribution_call_id BIGINT UNSIGNED NULL,
    ADD current_contract_id BIGINT UNSIGNED NULL,
    ADD active_contract_revision_id BIGINT UNSIGNED NULL;

ALTER TABLE project_contract_revisions
    CHANGE project_id project_uuid VARCHAR(100) NOT NULL,
    CHANGE smart_contract_id smart_contract_uuid VARCHAR(100) NOT NULL,
    ADD project_id BIGINT UNSIGNED NULL,
    ADD smart_contract_id BIGINT UNSIGNED NULL;

ALTER TABLE execution_branches
    CHANGE project_id project_uuid VARCHAR(100) NOT NULL,
    CHANGE root_contract_id root_contract_uuid VARCHAR(100) NULL,
    CHANGE forked_from_contract_id forked_from_contract_uuid VARCHAR(100) NULL,
    CHANGE head_contract_id head_contract_uuid VARCHAR(100) NULL,
    CHANGE current_contract_id current_contract_uuid VARCHAR(100) NULL,
    ADD project_id BIGINT UNSIGNED NULL,
    ADD root_contract_id BIGINT UNSIGNED NULL,
    ADD forked_from_contract_id BIGINT UNSIGNED NULL,
    ADD head_contract_id BIGINT UNSIGNED NULL,
    ADD current_contract_id BIGINT UNSIGNED NULL;

ALTER TABLE execution_contracts
    CHANGE project_id project_uuid VARCHAR(100) NOT NULL,
    CHANGE branch_id branch_uuid VARCHAR(100) NULL,
    CHANGE project_contract_revision_id project_contract_revision_uuid VARCHAR(100) NOT NULL,
    CHANGE parent_contract_id parent_contract_uuid VARCHAR(100) NULL,
    CHANGE supplement_of_contract_id supplement_of_contract_uuid VARCHAR(100) NULL,
    CHANGE retry_of_contract_id retry_of_contract_uuid VARCHAR(100) NULL,
    CHANGE smart_contract_id smart_contract_uuid VARCHAR(100) NOT NULL,
    CHANGE completion_record_id completion_record_uuid VARCHAR(100) NULL,
    CHANGE planning_conversation_id planning_conversation_uuid VARCHAR(100) NULL,
    CHANGE completion_conversation_id completion_conversation_uuid VARCHAR(100) NULL,
    ADD project_id BIGINT UNSIGNED NULL,
    ADD branch_id BIGINT UNSIGNED NULL,
    ADD project_contract_revision_id BIGINT UNSIGNED NULL,
    ADD parent_contract_id BIGINT UNSIGNED NULL,
    ADD supplement_of_contract_id BIGINT UNSIGNED NULL,
    ADD retry_of_contract_id BIGINT UNSIGNED NULL,
    ADD smart_contract_id BIGINT UNSIGNED NULL,
    ADD completion_record_id BIGINT UNSIGNED NULL,
    ADD planning_conversation_id BIGINT UNSIGNED NULL,
    ADD completion_conversation_id BIGINT UNSIGNED NULL;

ALTER TABLE execution_edges
    CHANGE source_contract_id source_contract_uuid VARCHAR(100) NOT NULL,
    CHANGE target_contract_id target_contract_uuid VARCHAR(100) NOT NULL,
    ADD source_contract_id BIGINT UNSIGNED NULL,
    ADD target_contract_id BIGINT UNSIGNED NULL;

ALTER TABLE node_conversations
    CHANGE project_id project_uuid VARCHAR(100) NOT NULL,
    CHANGE node_id node_uuid VARCHAR(100) NULL,
    ADD project_id BIGINT UNSIGNED NULL,
    ADD node_id BIGINT UNSIGNED NULL;

ALTER TABLE node_conversation_messages
    CHANGE conversation_id conversation_uuid VARCHAR(100) NOT NULL,
    ADD conversation_id BIGINT UNSIGNED NULL;

ALTER TABLE completion_records
    CHANGE project_id project_uuid VARCHAR(100) NOT NULL,
    CHANGE closing_contract_id closing_contract_uuid VARCHAR(100) NOT NULL,
    CHANGE smart_contract_id smart_contract_uuid VARCHAR(100) NOT NULL,
    ADD project_id BIGINT UNSIGNED NULL,
    ADD closing_contract_id BIGINT UNSIGNED NULL,
    ADD smart_contract_id BIGINT UNSIGNED NULL;

ALTER TABLE collaboration_calls
    CHANGE project_id project_uuid VARCHAR(100) NOT NULL,
    CHANGE target_contract_id target_contract_uuid VARCHAR(100) NOT NULL,
    ADD project_id BIGINT UNSIGNED NULL,
    ADD target_contract_id BIGINT UNSIGNED NULL;

ALTER TABLE collaboration_submissions
    CHANGE call_id call_uuid VARCHAR(100) NOT NULL,
    CHANGE source_record_id source_record_uuid VARCHAR(100) NOT NULL,
    ADD call_id BIGINT UNSIGNED NULL,
    ADD source_record_id BIGINT UNSIGNED NULL;

ALTER TABLE collaboration_review_batches
    CHANGE call_id call_uuid VARCHAR(100) NOT NULL,
    CHANGE project_id project_uuid VARCHAR(100) NOT NULL,
    CHANGE target_contract_id target_contract_uuid VARCHAR(100) NOT NULL,
    ADD call_id BIGINT UNSIGNED NULL,
    ADD project_id BIGINT UNSIGNED NULL,
    ADD target_contract_id BIGINT UNSIGNED NULL;

ALTER TABLE smart_contract_events
    CHANGE contract_id contract_uuid VARCHAR(100) NOT NULL,
    ADD contract_id BIGINT UNSIGNED NULL;

-- 第二阶段：通过实体 uuid 填充内部关系。NULL 关系维持 NULL。
UPDATE projects p
LEFT JOIN ai_api_keys k ON k.uuid = p.default_ai_key_uuid
LEFT JOIN collaboration_calls c ON c.uuid = p.contribution_call_uuid
LEFT JOIN execution_contracts n ON n.uuid = p.current_contract_uuid
LEFT JOIN project_contract_revisions r ON r.uuid = p.active_contract_revision_uuid
SET p.default_ai_key_id = k.id, p.contribution_call_id = c.id,
    p.current_contract_id = n.id, p.active_contract_revision_id = r.id;

UPDATE project_contract_revisions r
JOIN projects p ON p.uuid = r.project_uuid
JOIN smart_contracts c ON c.uuid = r.smart_contract_uuid
SET r.project_id = p.id, r.smart_contract_id = c.id;

UPDATE execution_branches b
JOIN projects p ON p.uuid = b.project_uuid
LEFT JOIN execution_contracts root ON root.uuid = b.root_contract_uuid
LEFT JOIN execution_contracts forked ON forked.uuid = b.forked_from_contract_uuid
LEFT JOIN execution_contracts head ON head.uuid = b.head_contract_uuid
LEFT JOIN execution_contracts current_node ON current_node.uuid = b.current_contract_uuid
SET b.project_id = p.id, b.root_contract_id = root.id, b.forked_from_contract_id = forked.id,
    b.head_contract_id = head.id, b.current_contract_id = current_node.id;

UPDATE execution_contracts n
JOIN projects p ON p.uuid = n.project_uuid
LEFT JOIN execution_branches b ON b.uuid = n.branch_uuid
JOIN project_contract_revisions r ON r.uuid = n.project_contract_revision_uuid
LEFT JOIN execution_contracts parent ON parent.uuid = n.parent_contract_uuid
LEFT JOIN execution_contracts supplement ON supplement.uuid = n.supplement_of_contract_uuid
LEFT JOIN execution_contracts retry_node ON retry_node.uuid = n.retry_of_contract_uuid
JOIN smart_contracts c ON c.uuid = n.smart_contract_uuid
LEFT JOIN completion_records record ON record.uuid = n.completion_record_uuid
LEFT JOIN node_conversations planning ON planning.uuid = n.planning_conversation_uuid
LEFT JOIN node_conversations completion ON completion.uuid = n.completion_conversation_uuid
SET n.project_id = p.id, n.branch_id = b.id, n.project_contract_revision_id = r.id,
    n.parent_contract_id = parent.id, n.supplement_of_contract_id = supplement.id,
    n.retry_of_contract_id = retry_node.id, n.smart_contract_id = c.id,
    n.completion_record_id = record.id, n.planning_conversation_id = planning.id,
    n.completion_conversation_id = completion.id;

UPDATE execution_edges e
JOIN execution_contracts source_node ON source_node.uuid = e.source_contract_uuid
JOIN execution_contracts target_node ON target_node.uuid = e.target_contract_uuid
SET e.source_contract_id = source_node.id, e.target_contract_id = target_node.id;

UPDATE node_conversations c
JOIN projects p ON p.uuid = c.project_uuid
LEFT JOIN execution_contracts n ON n.uuid = c.node_uuid
SET c.project_id = p.id, c.node_id = n.id;

UPDATE node_conversation_messages m
JOIN node_conversations c ON c.uuid = m.conversation_uuid
SET m.conversation_id = c.id;

UPDATE completion_records r
JOIN projects p ON p.uuid = r.project_uuid
JOIN execution_contracts n ON n.uuid = r.closing_contract_uuid
JOIN smart_contracts c ON c.uuid = r.smart_contract_uuid
SET r.project_id = p.id, r.closing_contract_id = n.id, r.smart_contract_id = c.id;

UPDATE collaboration_calls c
JOIN projects p ON p.uuid = c.project_uuid
JOIN execution_contracts n ON n.uuid = c.target_contract_uuid
SET c.project_id = p.id, c.target_contract_id = n.id;

UPDATE collaboration_submissions s
JOIN collaboration_calls c ON c.uuid = s.call_uuid
JOIN completion_records r ON r.uuid = s.source_record_uuid
SET s.call_id = c.id, s.source_record_id = r.id;

UPDATE collaboration_review_batches b
JOIN collaboration_calls c ON c.uuid = b.call_uuid
JOIN projects p ON p.uuid = b.project_uuid
JOIN execution_contracts n ON n.uuid = b.target_contract_uuid
SET b.call_id = c.id, b.project_id = p.id, b.target_contract_id = n.id;

UPDATE smart_contract_events e
JOIN smart_contracts c ON c.uuid = e.contract_uuid
SET e.contract_id = c.id;

-- JSON 内部关系也改存数字 ID。执行前先检查任何未能解析的 UUID，失败则不要继续删除旧列。
SELECT 'execution_contracts.source_contract_ids_json unresolved' AS check_name, COUNT(*) AS unresolved
FROM execution_contracts n
CROSS JOIN JSON_TABLE(COALESCE(n.source_contract_ids_json, JSON_ARRAY()), '$[*]' COLUMNS (old_uuid VARCHAR(100) PATH '$')) old_value
LEFT JOIN execution_contracts source_node ON source_node.uuid = old_value.old_uuid
WHERE source_node.id IS NULL
UNION ALL
SELECT 'completion_records.covered_contract_ids_json unresolved', COUNT(*)
FROM completion_records r
CROSS JOIN JSON_TABLE(COALESCE(r.covered_contract_ids_json, JSON_ARRAY()), '$[*]' COLUMNS (old_uuid VARCHAR(100) PATH '$')) old_value
LEFT JOIN execution_contracts covered_node ON covered_node.uuid = old_value.old_uuid
WHERE covered_node.id IS NULL
UNION ALL
SELECT 'collaboration_review_batches.submission_ids_json unresolved', COUNT(*)
FROM collaboration_review_batches b
CROSS JOIN JSON_TABLE(COALESCE(b.submission_ids_json, JSON_ARRAY()), '$[*]' COLUMNS (old_uuid VARCHAR(100) PATH '$')) old_value
LEFT JOIN collaboration_submissions submission ON submission.uuid = old_value.old_uuid
WHERE submission.id IS NULL;

-- MySQL prohibits directly reading a table from a subquery that updates it.
-- Materialize each conversion first, then join the materialized result back.
CREATE TABLE _exec_graph_contract_json_rekey (
    entity_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    relation_ids_json JSON NOT NULL
) ENGINE=InnoDB;
INSERT INTO _exec_graph_contract_json_rekey (entity_id, relation_ids_json)
SELECT n.id,
       CASE WHEN JSON_LENGTH(COALESCE(n.source_contract_ids_json, JSON_ARRAY())) = 0 THEN JSON_ARRAY()
            ELSE COALESCE((
                SELECT JSON_ARRAYAGG(source_node.id)
                FROM JSON_TABLE(n.source_contract_ids_json, '$[*]' COLUMNS (old_uuid VARCHAR(100) PATH '$')) old_value
                JOIN execution_contracts source_node ON source_node.uuid = old_value.old_uuid
            ), JSON_ARRAY()) END
FROM execution_contracts n;
UPDATE execution_contracts n
JOIN _exec_graph_contract_json_rekey staged ON staged.entity_id = n.id
SET n.source_contract_ids_json = staged.relation_ids_json;
DROP TABLE _exec_graph_contract_json_rekey;

CREATE TABLE _exec_graph_record_json_rekey (
    entity_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    relation_ids_json JSON NOT NULL
) ENGINE=InnoDB;
INSERT INTO _exec_graph_record_json_rekey (entity_id, relation_ids_json)
SELECT r.id,
       CASE WHEN JSON_LENGTH(COALESCE(r.covered_contract_ids_json, JSON_ARRAY())) = 0 THEN JSON_ARRAY()
            ELSE COALESCE((
                SELECT JSON_ARRAYAGG(covered_node.id)
                FROM JSON_TABLE(r.covered_contract_ids_json, '$[*]' COLUMNS (old_uuid VARCHAR(100) PATH '$')) old_value
                JOIN execution_contracts covered_node ON covered_node.uuid = old_value.old_uuid
            ), JSON_ARRAY()) END
FROM completion_records r;
UPDATE completion_records r
JOIN _exec_graph_record_json_rekey staged ON staged.entity_id = r.id
SET r.covered_contract_ids_json = staged.relation_ids_json;
DROP TABLE _exec_graph_record_json_rekey;

CREATE TABLE _exec_graph_submission_json_rekey (
    entity_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    relation_ids_json JSON NOT NULL
) ENGINE=InnoDB;
INSERT INTO _exec_graph_submission_json_rekey (entity_id, relation_ids_json)
SELECT b.id,
       CASE WHEN JSON_LENGTH(COALESCE(b.submission_ids_json, JSON_ARRAY())) = 0 THEN JSON_ARRAY()
            ELSE COALESCE((
                SELECT JSON_ARRAYAGG(submission.id)
                FROM JSON_TABLE(b.submission_ids_json, '$[*]' COLUMNS (old_uuid VARCHAR(100) PATH '$')) old_value
                JOIN collaboration_submissions submission ON submission.uuid = old_value.old_uuid
            ), JSON_ARRAY()) END
FROM collaboration_review_batches b;
UPDATE collaboration_review_batches b
JOIN _exec_graph_submission_json_rekey staged ON staged.entity_id = b.id
SET b.submission_ids_json = staged.relation_ids_json;
DROP TABLE _exec_graph_submission_json_rekey;

-- 第三阶段：收紧必填关系。若旧 UUID 无法映射，此处会失败并保留旧列，
-- 操作员必须修复数据后从备份重新执行，不能带着断链进入最终结构。
ALTER TABLE project_contract_revisions MODIFY project_id BIGINT UNSIGNED NOT NULL, MODIFY smart_contract_id BIGINT UNSIGNED NOT NULL;
ALTER TABLE execution_branches MODIFY project_id BIGINT UNSIGNED NOT NULL;
ALTER TABLE execution_contracts MODIFY project_id BIGINT UNSIGNED NOT NULL, MODIFY project_contract_revision_id BIGINT UNSIGNED NOT NULL, MODIFY smart_contract_id BIGINT UNSIGNED NOT NULL;
ALTER TABLE execution_edges MODIFY source_contract_id BIGINT UNSIGNED NOT NULL, MODIFY target_contract_id BIGINT UNSIGNED NOT NULL;
ALTER TABLE node_conversations MODIFY project_id BIGINT UNSIGNED NOT NULL;
ALTER TABLE node_conversation_messages MODIFY conversation_id BIGINT UNSIGNED NOT NULL;
ALTER TABLE completion_records MODIFY project_id BIGINT UNSIGNED NOT NULL, MODIFY closing_contract_id BIGINT UNSIGNED NOT NULL, MODIFY smart_contract_id BIGINT UNSIGNED NOT NULL;
ALTER TABLE collaboration_calls MODIFY project_id BIGINT UNSIGNED NOT NULL, MODIFY target_contract_id BIGINT UNSIGNED NOT NULL;
ALTER TABLE collaboration_submissions MODIFY call_id BIGINT UNSIGNED NOT NULL, MODIFY source_record_id BIGINT UNSIGNED NOT NULL;
ALTER TABLE collaboration_review_batches MODIFY call_id BIGINT UNSIGNED NOT NULL, MODIFY project_id BIGINT UNSIGNED NOT NULL, MODIFY target_contract_id BIGINT UNSIGNED NOT NULL;
ALTER TABLE smart_contract_events MODIFY contract_id BIGINT UNSIGNED NOT NULL;

-- 第四阶段：删除旧 UUID 关系列，建立查询索引。
ALTER TABLE projects
    DROP COLUMN default_ai_key_uuid, DROP COLUMN contribution_call_uuid,
    DROP COLUMN current_contract_uuid, DROP COLUMN active_contract_revision_uuid,
    ADD KEY idx_projects_default_ai_key_id (default_ai_key_id),
    ADD KEY idx_projects_contribution_call_id (contribution_call_id),
    ADD KEY idx_projects_current_contract_id (current_contract_id),
    ADD KEY idx_projects_active_contract_revision_id (active_contract_revision_id);

ALTER TABLE project_contract_revisions
    DROP COLUMN project_uuid, DROP COLUMN smart_contract_uuid,
    ADD KEY idx_project_contract_revisions_project_id (project_id),
    ADD KEY idx_project_contract_revisions_smart_contract_id (smart_contract_id);

ALTER TABLE execution_branches
    DROP COLUMN project_uuid, DROP COLUMN root_contract_uuid, DROP COLUMN forked_from_contract_uuid,
    DROP COLUMN head_contract_uuid, DROP COLUMN current_contract_uuid,
    ADD KEY idx_execution_branches_project_id (project_id),
    ADD KEY idx_execution_branches_root_contract_id (root_contract_id),
    ADD KEY idx_execution_branches_forked_from_contract_id (forked_from_contract_id),
    ADD KEY idx_execution_branches_head_contract_id (head_contract_id),
    ADD KEY idx_execution_branches_current_contract_id (current_contract_id);

ALTER TABLE execution_contracts
    DROP COLUMN project_uuid, DROP COLUMN branch_uuid, DROP COLUMN project_contract_revision_uuid,
    DROP COLUMN parent_contract_uuid, DROP COLUMN supplement_of_contract_uuid, DROP COLUMN retry_of_contract_uuid,
    DROP COLUMN smart_contract_uuid, DROP COLUMN completion_record_uuid, DROP COLUMN planning_conversation_uuid,
    DROP COLUMN completion_conversation_uuid,
    ADD KEY idx_execution_contracts_project_id (project_id),
    ADD KEY idx_execution_contracts_branch_id (branch_id),
    ADD KEY idx_execution_contracts_revision_id (project_contract_revision_id),
    ADD KEY idx_execution_contracts_parent_contract_id (parent_contract_id),
    ADD KEY idx_execution_contracts_supplement_of_contract_id (supplement_of_contract_id),
    ADD KEY idx_execution_contracts_retry_of_contract_id (retry_of_contract_id),
    ADD KEY idx_execution_contracts_smart_contract_id (smart_contract_id),
    ADD KEY idx_execution_contracts_completion_record_id (completion_record_id),
    ADD KEY idx_execution_contracts_planning_conversation_id (planning_conversation_id),
    ADD KEY idx_execution_contracts_completion_conversation_id (completion_conversation_id);

ALTER TABLE execution_edges
    DROP COLUMN source_contract_uuid, DROP COLUMN target_contract_uuid,
    ADD KEY idx_execution_edges_source_contract_id (source_contract_id),
    ADD KEY idx_execution_edges_target_contract_id (target_contract_id);

ALTER TABLE node_conversations DROP COLUMN project_uuid, DROP COLUMN node_uuid,
    ADD KEY idx_node_conversations_project_id (project_id), ADD KEY idx_node_conversations_node_id (node_id);
ALTER TABLE node_conversation_messages DROP COLUMN conversation_uuid,
    ADD KEY idx_node_conversation_messages_conversation_id (conversation_id);
ALTER TABLE completion_records DROP COLUMN project_uuid, DROP COLUMN closing_contract_uuid, DROP COLUMN smart_contract_uuid,
    ADD KEY idx_completion_records_project_id (project_id), ADD KEY idx_completion_records_closing_contract_id (closing_contract_id),
    ADD KEY idx_completion_records_smart_contract_id (smart_contract_id);
ALTER TABLE collaboration_calls DROP COLUMN project_uuid, DROP COLUMN target_contract_uuid,
    ADD KEY idx_collaboration_calls_project_id (project_id), ADD KEY idx_collaboration_calls_target_contract_id (target_contract_id);
ALTER TABLE collaboration_submissions DROP COLUMN call_uuid, DROP COLUMN source_record_uuid,
    ADD KEY idx_collaboration_submissions_call_id (call_id), ADD KEY idx_collaboration_submissions_source_record_id (source_record_id);
ALTER TABLE collaboration_review_batches DROP COLUMN call_uuid, DROP COLUMN project_uuid, DROP COLUMN target_contract_uuid,
    ADD KEY idx_collaboration_review_batches_call_id (call_id), ADD KEY idx_collaboration_review_batches_project_id (project_id),
    ADD KEY idx_collaboration_review_batches_target_contract_id (target_contract_id);
ALTER TABLE smart_contract_events DROP COLUMN contract_uuid, ADD KEY idx_smart_contract_events_contract_id (contract_id);

-- 进展日志功能和 MySQL 会话回退均已删除；会话由 Redis 独占。
DROP TABLE execution_work_logs;
DROP TABLE auth_sessions;

-- review_id 是一次 AI 审查的业务标记，并非指向实体表，继续保持字符串。
-- 外键在此处不添加：项目删除、节点重试和历史封存都有明确的业务删除流程，
-- 当前代码需先完成删除顺序的领域化重构；数字列和索引保证内部关联一致且可高效查询。
