-- 迁移后的只读验收。预期所有查询均不返回行。

SELECT table_name, column_name, column_type
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND column_name LIKE '%\\_id' ESCAPE '\\'
  AND CONCAT(table_name, '.', column_name) NOT IN ('users.user_id', 'completion_records.review_id')
  AND column_type <> 'bigint unsigned';

SELECT table_name
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name IN ('auth_sessions', 'execution_work_logs');

SELECT table_name
FROM information_schema.tables table_info
WHERE table_info.table_schema = DATABASE()
  AND table_info.table_name IN (
      'ai_api_keys', 'smart_contracts', 'projects', 'project_contract_revisions',
      'execution_branches', 'execution_contracts', 'execution_edges',
      'node_conversations', 'node_conversation_messages', 'completion_records',
      'collaboration_calls', 'collaboration_submissions',
      'collaboration_review_batches', 'daily_work_reviews', 'smart_contract_events'
  )
  AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns column_info
      WHERE column_info.table_schema = table_info.table_schema
        AND column_info.table_name = table_info.table_name
        AND column_info.column_name = 'uuid'
        AND column_info.column_type = 'varchar(100)'
  );

SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND column_name LIKE '%\\_id' ESCAPE '\\'
  AND CONCAT(table_name, '.', column_name) NOT IN ('users.user_id', 'completion_records.review_id')
  AND column_comment = '';
