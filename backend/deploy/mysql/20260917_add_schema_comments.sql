-- 作为数据库部署的一部分手工执行；API 进程不会自动执行此脚本。
-- 本脚本只更新 MySQL 的表和字段注释，并保留字段类型、默认值、字符集和自增属性。

DROP PROCEDURE IF EXISTS apply_schema_comments;

DELIMITER //

CREATE PROCEDURE apply_schema_comments()
BEGIN
    DECLARE done BOOLEAN DEFAULT FALSE;
    DECLARE table_name_value VARCHAR(64);
    DECLARE column_name_value VARCHAR(64);
    DECLARE column_type_value TEXT;
    DECLARE nullable_value VARCHAR(3);
    DECLARE default_value TEXT;
    DECLARE extra_value TEXT;
    DECLARE charset_value VARCHAR(64);
    DECLARE collation_value VARCHAR(64);
    DECLARE comment_value TEXT;
    DECLARE statement_value LONGTEXT;

    DECLARE column_cursor CURSOR FOR
        SELECT
            c.table_name,
            c.column_name,
            c.column_type,
            c.is_nullable,
            c.column_default,
            c.extra,
            c.character_set_name,
            c.collation_name,
            CASE
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'ai_api_keys.id' THEN 'AI 密钥配置标识'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'ai_api_keys.provider' THEN 'AI 服务供应商标识'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'ai_api_keys.label' THEN '用户为密钥配置设置的名称'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'ai_api_keys.key_ciphertext' THEN '加密后的 AI 密钥，禁止明文存储'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'ai_api_keys.key_hint' THEN '密钥脱敏提示，用于用户识别配置'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'ai_api_keys.base_url' THEN 'AI 服务 API 基础地址'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'ai_api_keys.model' THEN '调用的模型名称'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'ai_api_keys.is_default' THEN '是否为该用户的默认 AI 配置'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'ai_api_keys.last_verified_at' THEN '最近一次验证此 AI 配置的时间'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'ai_api_keys.last_used_at' THEN '最近一次使用此 AI 配置的时间'

                WHEN CONCAT(c.table_name, '.', c.column_name) = 'auth_sessions.id' THEN '遗留 MySQL 会话记录标识'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'auth_sessions.token_hash' THEN '遗留会话令牌哈希；当前会话只存 Redis'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'auth_sessions.expires_at' THEN '遗留会话的过期时间'

                WHEN CONCAT(c.table_name, '.', c.column_name) = 'collaboration_calls.id' THEN '协作征集标识'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'collaboration_calls.target_contract_id' THEN '待协作推进的目标节点标识'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'collaboration_calls.title' THEN '公开协作征集标题'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'collaboration_calls.status' THEN '协作征集状态'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'collaboration_calls.max_submissions' THEN '允许接收的最大投稿数量'

                WHEN CONCAT(c.table_name, '.', c.column_name) = 'collaboration_review_batches.id' THEN '协作投稿审查批次标识'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'collaboration_review_batches.call_id' THEN '所属协作征集标识'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'collaboration_review_batches.target_contract_id' THEN '审查结果要回填的目标节点标识'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'collaboration_review_batches.submission_ids_json' THEN '纳入该审查批次的投稿标识列表'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'collaboration_review_batches.ai_review_json' THEN 'AI 对该投稿批次生成的审查结果'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'collaboration_review_batches.status' THEN '审查批次状态'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'collaboration_review_batches.adopted_at' THEN '审查批次被正式采纳的时间'

                WHEN CONCAT(c.table_name, '.', c.column_name) = 'collaboration_submissions.id' THEN '协作投稿标识'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'collaboration_submissions.call_id' THEN '投稿响应的协作征集标识'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'collaboration_submissions.source_record_id' THEN '作为投稿来源的完成记录标识'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'collaboration_submissions.contributor_id' THEN '投稿贡献者的用户标识'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'collaboration_submissions.mapping_text' THEN '投稿成果与目标验收要求的对应说明'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'collaboration_submissions.note' THEN '贡献者补充说明'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'collaboration_submissions.status' THEN '投稿状态，例如待审或已采纳'

                WHEN CONCAT(c.table_name, '.', c.column_name) = 'completion_records.id' THEN '完成成果记录标识'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'completion_records.closing_contract_id' THEN '形成该成果的结束节点标识'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'completion_records.covered_contract_ids_json' THEN '被该成果覆盖的节点标识列表'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'completion_records.title' THEN '成果标题'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'completion_records.summary' THEN '成果摘要与可见结论'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'completion_records.review_id' THEN '对应完成审查的标识'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'completion_records.ai_review_verdict' THEN 'AI 对完成提交给出的结论'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'completion_records.record_kind' THEN '成果记录类型，例如完成、封存或采纳'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'completion_records.user_verdict_json' THEN '用户确认的审查结论快照'

                WHEN CONCAT(c.table_name, '.', c.column_name) = 'daily_work_reviews.id' THEN '每日工作回顾标识'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'daily_work_reviews.review_date' THEN '该回顾对应的自然日'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'daily_work_reviews.review_json' THEN 'AI 生成的每日推进回顾内容'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'daily_work_reviews.ai_config_json' THEN '生成该回顾时使用的 AI 配置快照'

                WHEN CONCAT(c.table_name, '.', c.column_name) = 'email_verification_codes.id' THEN '邮箱验证码记录标识'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'email_verification_codes.email' THEN '接收验证码的邮箱地址'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'email_verification_codes.purpose' THEN '验证码用途，例如注册或重置密码'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'email_verification_codes.code_hash' THEN '验证码哈希，禁止存储明文验证码'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'email_verification_codes.expires_at' THEN '验证码过期时间'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'email_verification_codes.used_at' THEN '验证码被使用或作废的时间'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'email_verification_codes.send_ip' THEN '发送验证码时的客户端 IP'

                WHEN CONCAT(c.table_name, '.', c.column_name) = 'execution_branches.id' THEN '执行分支标识'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'execution_branches.title' THEN '执行分支名称'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'execution_branches.root_contract_id' THEN '分支根节点标识'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'execution_branches.forked_from_contract_id' THEN '该分支从其分出的原节点标识'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'execution_branches.head_contract_id' THEN '分支最末端节点标识'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'execution_branches.current_contract_id' THEN '分支当前正在推进的节点标识'

                WHEN CONCAT(c.table_name, '.', c.column_name) = 'execution_contracts.id' THEN '执行节点标识'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'execution_contracts.branch_id' THEN '所属执行分支标识'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'execution_contracts.project_contract_revision_id' THEN '节点冻结时采用的项目合约修订版本标识'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'execution_contracts.parent_contract_id' THEN '父节点标识'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'execution_contracts.source_contract_ids_json' THEN '该节点依赖或引用的来源节点标识列表'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'execution_contracts.supplement_of_contract_id' THEN '该节点补足的原节点标识'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'execution_contracts.retry_of_contract_id' THEN '该节点重试的原节点标识'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'execution_contracts.title' THEN '执行节点标题'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'execution_contracts.stage' THEN '节点生命周期阶段'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'execution_contracts.original_intent' THEN '用户最初提出的推进意图'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'execution_contracts.verifiable_goal' THEN '冻结后的可验证目标'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'execution_contracts.acceptance_criteria_json' THEN '冻结后的验收标准列表'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'execution_contracts.evidence_requirement' THEN '提交完成时所需证据的说明'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'execution_contracts.completion_claim' THEN '用户提交的完成说明'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'execution_contracts.evidence_text' THEN '用户提交的逐条证据内容'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'execution_contracts.started_at' THEN '用户选填的实际开始时间'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'execution_contracts.ended_at' THEN '用户选填的实际结束时间'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'execution_contracts.completion_record_id' THEN '节点通过后生成的成果记录标识'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'execution_contracts.draft_review_json' THEN '节点草案阶段的 AI 审查结果'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'execution_contracts.draft_review_ai_config_json' THEN '草案审查使用的 AI 配置快照'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'execution_contracts.review_messages_json' THEN '节点审查消息记录快照'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'execution_contracts.ai_review_json' THEN '完成提交的 AI 审查结果'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'execution_contracts.completion_review_ai_config_json' THEN '完成审查使用的 AI 配置快照'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'execution_contracts.completion_review_rounds_json' THEN '完成审查轮次及结果快照'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'execution_contracts.planning_conversation_id' THEN '起草该节点的 AI 对话标识'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'execution_contracts.completion_conversation_id' THEN '完成审查的 AI 对话标识'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'execution_contracts.user_verdict_json' THEN '用户确认的审查结论快照'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'execution_contracts.next_contract_title' THEN '审查建议的下一节点标题'

                WHEN CONCAT(c.table_name, '.', c.column_name) = 'execution_edges.id' THEN '执行图边标识'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'execution_edges.source_contract_id' THEN '关系来源节点标识'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'execution_edges.target_contract_id' THEN '关系目标节点标识'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'execution_edges.type' THEN '节点关系类型'

                WHEN CONCAT(c.table_name, '.', c.column_name) = 'execution_work_logs.id' THEN '遗留进展日志标识'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'execution_work_logs.contract_id' THEN '遗留进展日志所属节点标识'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'execution_work_logs.body' THEN '遗留进展日志正文；功能已移除'

                WHEN CONCAT(c.table_name, '.', c.column_name) = 'node_conversations.id' THEN '节点 AI 对话标识'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'node_conversations.node_id' THEN '关联执行节点标识；起草前可为空'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'node_conversations.phase' THEN '对话所处阶段，例如起草或完成审查'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'node_conversations.status' THEN '对话状态'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'node_conversations.context_json' THEN '创建对话时带入的项目和节点上下文'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'node_conversations.current_draft_json' THEN '当前节点草案快照'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'node_conversations.latest_review_json' THEN '最近一次 AI 审查结果'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'node_conversations.ai_config_json' THEN '此对话使用的 AI 配置快照'

                WHEN CONCAT(c.table_name, '.', c.column_name) = 'node_conversation_messages.id' THEN '节点对话消息标识'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'node_conversation_messages.conversation_id' THEN '所属节点 AI 对话标识'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'node_conversation_messages.role' THEN '消息角色，例如用户或 AI'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'node_conversation_messages.body' THEN '对话消息正文'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'node_conversation_messages.structured_payload_json' THEN '消息附带的结构化数据'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'node_conversation_messages.ai_config_json' THEN '生成该 AI 消息时使用的配置快照'

                WHEN CONCAT(c.table_name, '.', c.column_name) = 'project_contract_revisions.id' THEN '项目合约修订记录标识'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'project_contract_revisions.smart_contract_id' THEN '采用的智能合约标识'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'project_contract_revisions.smart_contract_version' THEN '采用时的智能合约版本'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'project_contract_revisions.reason' THEN '切换或创建该合约修订的原因'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'project_contract_revisions.smart_contract_name' THEN '采用时的智能合约名称快照'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'project_contract_revisions.smart_contract_description' THEN '采用时的智能合约说明快照'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'project_contract_revisions.smart_contract_body' THEN '采用时的智能合约正文快照'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'project_contract_revisions.activated_at' THEN '该修订开始生效的时间'

                WHEN CONCAT(c.table_name, '.', c.column_name) = 'projects.id' THEN '项目标识'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'projects.title' THEN '项目名称'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'projects.description' THEN '项目说明'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'projects.project_type' THEN '项目类型，例如自主推进或协作贡献'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'projects.project_rules' THEN '项目的自定义推进规则'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'projects.is_default' THEN '历史默认项目标记；当前项目不再依赖默认项目'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'projects.visibility' THEN '项目可见范围'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'projects.default_ai_key_id' THEN '该项目默认使用的 AI 密钥配置标识'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'projects.contribution_call_id' THEN '创建该项目的来源协作征集标识'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'projects.contribution_origin_snapshot_json' THEN '创建贡献项目时保留的来源上下文快照'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'projects.current_contract_id' THEN '项目当前正在推进的节点标识'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'projects.active_contract_revision_id' THEN '项目当前生效的合约修订标识'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'projects.archived_at' THEN '项目归档时间；为空表示未归档'

                WHEN CONCAT(c.table_name, '.', c.column_name) = 'smart_contracts.id' THEN '智能合约标识'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'smart_contracts.name' THEN '智能合约名称'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'smart_contracts.source' THEN '合约来源，例如官方或用户自定义'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'smart_contracts.version' THEN '智能合约版本号'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'smart_contracts.description' THEN '智能合约用途说明'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'smart_contracts.body' THEN '智能合约完整规则内容'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'smart_contracts.deleted_at' THEN '软删除时间'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'smart_contracts.deleted_by' THEN '执行软删除的用户标识'

                WHEN CONCAT(c.table_name, '.', c.column_name) = 'smart_contract_events.id' THEN '智能合约事件标识'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'smart_contract_events.contract_id' THEN '发生事件的智能合约标识'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'smart_contract_events.event_type' THEN '合约事件类型'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'smart_contract_events.contract_snapshot_json' THEN '事件发生时的完整合约快照'

                WHEN CONCAT(c.table_name, '.', c.column_name) = 'users.id' THEN '用户内部主键'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'users.username' THEN '用户显示名称'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'users.user_id' THEN '对外展示的用户标识'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'users.is_test_account' THEN '是否为测试账号；由数据库数据维护'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'users.email' THEN '登录邮箱地址'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'users.password_hash' THEN '密码哈希，禁止存储明文密码'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'users.email_verified_at' THEN '邮箱验证完成时间'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'users.bio' THEN '用户个人简介'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'users.gender' THEN '用户填写的性别信息'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'users.avatar_url' THEN '头像对象存储地址'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'users.custom_profile_enabled' THEN '是否启用自定义公开个人页'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'users.custom_profile_markdown' THEN '自定义个人页 Markdown 内容'
                WHEN CONCAT(c.table_name, '.', c.column_name) = 'users.profile_background_url' THEN '个人页背景图对象存储地址'

                WHEN c.column_name = 'id' THEN '内部自增主键，仅供数据库关联和索引使用'
                WHEN c.column_name = 'uuid' THEN '对外公开的随机标识；API 和 URL 使用此字段'
                WHEN c.column_name = 'project_id' THEN '所属项目标识'
                WHEN c.column_name = 'user_id' THEN '所属用户标识'
                WHEN c.column_name = 'owner_id' THEN '资源所有者的用户标识'
                WHEN c.column_name = 'created_by' THEN '创建该资源的用户标识'
                WHEN c.column_name = 'actor_id' THEN '执行该节点或事件的用户标识'
                WHEN c.column_name = 'smart_contract_id' THEN '关联智能合约标识'
                WHEN c.column_name = 'smart_contract_version' THEN '关联智能合约版本'
                WHEN c.column_name = 'status' THEN '当前业务状态'
                WHEN c.column_name = 'created_at' THEN '记录创建时间'
                WHEN c.column_name = 'updated_at' THEN '记录最后更新时间'
                ELSE CONCAT('业务字段：', c.column_name)
            END
        FROM information_schema.columns AS c
        WHERE c.table_schema = DATABASE()
          AND c.table_name IN (
              'ai_api_keys', 'auth_sessions', 'collaboration_calls', 'collaboration_review_batches',
              'collaboration_submissions', 'completion_records', 'daily_work_reviews',
              'email_verification_codes', 'execution_branches', 'execution_contracts', 'execution_edges',
              'execution_work_logs', 'node_conversation_messages', 'node_conversations',
              'project_contract_revisions', 'projects', 'smart_contract_events', 'smart_contracts', 'users'
          )
        ORDER BY c.table_name, c.ordinal_position;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

    ALTER TABLE ai_api_keys COMMENT = '用户保存的 AI 服务密钥配置';
    ALTER TABLE auth_sessions COMMENT = '遗留的 MySQL 会话表；当前会话强依赖 Redis';
    ALTER TABLE collaboration_calls COMMENT = '项目公开发布的协作征集和开放缺口';
    ALTER TABLE collaboration_review_batches COMMENT = '协作投稿的成批 AI 审查与采纳记录';
    ALTER TABLE collaboration_submissions COMMENT = '贡献者对协作征集提交的成果';
    ALTER TABLE completion_records COMMENT = '节点完成、封存或采纳后形成的可追溯成果';
    ALTER TABLE daily_work_reviews COMMENT = '工作总览中的 AI 每日回顾';
    ALTER TABLE email_verification_codes COMMENT = '邮箱验证和安全操作使用的一次性验证码';
    ALTER TABLE execution_branches COMMENT = '项目执行图中的分支路径';
    ALTER TABLE execution_contracts COMMENT = '项目推进节点、冻结规则、证据与审查结果';
    ALTER TABLE execution_edges COMMENT = '执行节点之间的有向关系边';
    ALTER TABLE execution_work_logs COMMENT = '遗留进展日志表；保存进展功能已移除';
    ALTER TABLE node_conversation_messages COMMENT = '节点 AI 对话中的单条消息';
    ALTER TABLE node_conversations COMMENT = '节点起草与完成审查的 AI 对话会话';
    ALTER TABLE project_contract_revisions COMMENT = '项目采用智能合约时保存的版本快照';
    ALTER TABLE projects COMMENT = '用户创建、参与或维护的执行项目';
    ALTER TABLE smart_contract_events COMMENT = '智能合约变更的审计事件';
    ALTER TABLE smart_contracts COMMENT = '官方或用户自定义的智能合约规则模板';
    ALTER TABLE users COMMENT = '用户账号和公开个人资料';

    OPEN column_cursor;
    comment_loop: LOOP
        FETCH column_cursor INTO table_name_value, column_name_value, column_type_value, nullable_value,
            default_value, extra_value, charset_value, collation_value, comment_value;
        IF done THEN
            LEAVE comment_loop;
        END IF;

        SET statement_value = CONCAT(
            'ALTER TABLE `', REPLACE(table_name_value, '`', '``'), '` MODIFY COLUMN `',
            REPLACE(column_name_value, '`', '``'), '` ', column_type_value,
            IF(charset_value IS NULL, '', CONCAT(' CHARACTER SET ', charset_value)),
            IF(collation_value IS NULL, '', CONCAT(' COLLATE ', collation_value)),
            IF(nullable_value = 'NO', ' NOT NULL', ' NULL'),
            IF(default_value IS NULL, '', CONCAT(' DEFAULT ',
                IF(UPPER(default_value) IN ('CURRENT_TIMESTAMP', 'CURRENT_TIMESTAMP()'), UPPER(default_value), QUOTE(default_value)))),
            IF(LOCATE('on update current_timestamp', LOWER(extra_value)) > 0, ' ON UPDATE CURRENT_TIMESTAMP', ''),
            IF(LOCATE('auto_increment', LOWER(extra_value)) > 0, ' AUTO_INCREMENT', ''),
            ' COMMENT ', QUOTE(comment_value)
        );
        SET @schema_comment_statement = statement_value;
        PREPARE comment_statement FROM @schema_comment_statement;
        EXECUTE comment_statement;
        DEALLOCATE PREPARE comment_statement;
    END LOOP;
    CLOSE column_cursor;
END//

DELIMITER ;

CALL apply_schema_comments();
DROP PROCEDURE apply_schema_comments;
