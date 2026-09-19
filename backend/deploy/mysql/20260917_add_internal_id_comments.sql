-- 为内部数字关系字段补充中文注释。原有字段注释在前一轮注释部署中已存在。

ALTER TABLE projects
    MODIFY default_ai_key_id BIGINT UNSIGNED NULL COMMENT '该项目默认使用的 AI 密钥配置内部标识',
    MODIFY contribution_call_id BIGINT UNSIGNED NULL COMMENT '创建该项目的来源协作征集内部标识',
    MODIFY current_contract_id BIGINT UNSIGNED NULL COMMENT '项目当前正在推进的节点内部标识',
    MODIFY active_contract_revision_id BIGINT UNSIGNED NULL COMMENT '项目当前生效的合约修订内部标识';

ALTER TABLE project_contract_revisions
    MODIFY project_id BIGINT UNSIGNED NOT NULL COMMENT '所属项目内部标识',
    MODIFY smart_contract_id BIGINT UNSIGNED NOT NULL COMMENT '采用的智能合约内部标识';

ALTER TABLE execution_branches
    MODIFY project_id BIGINT UNSIGNED NOT NULL COMMENT '所属项目内部标识',
    MODIFY root_contract_id BIGINT UNSIGNED NULL COMMENT '分支根节点内部标识',
    MODIFY forked_from_contract_id BIGINT UNSIGNED NULL COMMENT '该分支从其分出的原节点内部标识',
    MODIFY head_contract_id BIGINT UNSIGNED NULL COMMENT '分支最末端节点内部标识',
    MODIFY current_contract_id BIGINT UNSIGNED NULL COMMENT '分支当前正在推进的节点内部标识';

ALTER TABLE execution_contracts
    MODIFY project_id BIGINT UNSIGNED NOT NULL COMMENT '所属项目内部标识',
    MODIFY branch_id BIGINT UNSIGNED NULL COMMENT '所属执行分支内部标识',
    MODIFY project_contract_revision_id BIGINT UNSIGNED NOT NULL COMMENT '节点冻结时采用的项目合约修订内部标识',
    MODIFY parent_contract_id BIGINT UNSIGNED NULL COMMENT '父节点内部标识',
    MODIFY supplement_of_contract_id BIGINT UNSIGNED NULL COMMENT '该节点补足的原节点内部标识',
    MODIFY retry_of_contract_id BIGINT UNSIGNED NULL COMMENT '该节点重试的原节点内部标识',
    MODIFY smart_contract_id BIGINT UNSIGNED NOT NULL COMMENT '关联智能合约内部标识',
    MODIFY completion_record_id BIGINT UNSIGNED NULL COMMENT '节点通过后生成的成果记录内部标识',
    MODIFY planning_conversation_id BIGINT UNSIGNED NULL COMMENT '起草该节点的 AI 对话内部标识',
    MODIFY completion_conversation_id BIGINT UNSIGNED NULL COMMENT '完成审查的 AI 对话内部标识';

ALTER TABLE execution_edges
    MODIFY source_contract_id BIGINT UNSIGNED NOT NULL COMMENT '关系来源节点内部标识',
    MODIFY target_contract_id BIGINT UNSIGNED NOT NULL COMMENT '关系目标节点内部标识';

ALTER TABLE node_conversations
    MODIFY project_id BIGINT UNSIGNED NOT NULL COMMENT '所属项目内部标识',
    MODIFY node_id BIGINT UNSIGNED NULL COMMENT '关联执行节点内部标识；起草前可为空';

ALTER TABLE node_conversation_messages
    MODIFY conversation_id BIGINT UNSIGNED NOT NULL COMMENT '所属节点 AI 对话内部标识';

ALTER TABLE completion_records
    MODIFY project_id BIGINT UNSIGNED NOT NULL COMMENT '所属项目内部标识',
    MODIFY closing_contract_id BIGINT UNSIGNED NOT NULL COMMENT '形成该成果的结束节点内部标识',
    MODIFY smart_contract_id BIGINT UNSIGNED NOT NULL COMMENT '关联智能合约内部标识';

ALTER TABLE collaboration_calls
    MODIFY project_id BIGINT UNSIGNED NOT NULL COMMENT '所属项目内部标识',
    MODIFY target_contract_id BIGINT UNSIGNED NOT NULL COMMENT '待协作推进的目标节点内部标识';

ALTER TABLE collaboration_submissions
    MODIFY call_id BIGINT UNSIGNED NOT NULL COMMENT '投稿响应的协作征集内部标识',
    MODIFY source_record_id BIGINT UNSIGNED NOT NULL COMMENT '作为投稿来源的完成记录内部标识';

ALTER TABLE collaboration_review_batches
    MODIFY call_id BIGINT UNSIGNED NOT NULL COMMENT '所属协作征集内部标识',
    MODIFY project_id BIGINT UNSIGNED NOT NULL COMMENT '所属项目内部标识',
    MODIFY target_contract_id BIGINT UNSIGNED NOT NULL COMMENT '审查结果要回填的目标节点内部标识';

ALTER TABLE smart_contract_events
    MODIFY contract_id BIGINT UNSIGNED NOT NULL COMMENT '发生事件的智能合约内部标识';
