-- 检查 HTTP 会读取的历史 JSON 是否仍使用旧的资源标识字段名。

SELECT 'execution_contracts.draft_review_json.id' AS item, COUNT(*) AS remaining
FROM execution_contracts
WHERE JSON_VALID(draft_review_json) AND JSON_CONTAINS_PATH(draft_review_json, 'one', '$.id')
UNION ALL
SELECT 'execution_contracts.draft_review_ai_config_json.keyId', COUNT(*)
FROM execution_contracts
WHERE JSON_VALID(draft_review_ai_config_json) AND JSON_CONTAINS_PATH(draft_review_ai_config_json, 'one', '$.keyId')
UNION ALL
SELECT 'execution_contracts.review_messages_json[*].id', COUNT(*)
FROM execution_contracts
WHERE JSON_VALID(review_messages_json) AND JSON_CONTAINS_PATH(review_messages_json, 'one', '$[*].id')
UNION ALL
SELECT 'execution_contracts.ai_review_json.id', COUNT(*)
FROM execution_contracts
WHERE JSON_VALID(ai_review_json) AND JSON_CONTAINS_PATH(ai_review_json, 'one', '$.id')
UNION ALL
SELECT 'execution_contracts.completion_review_ai_config_json.keyId', COUNT(*)
FROM execution_contracts
WHERE JSON_VALID(completion_review_ai_config_json) AND JSON_CONTAINS_PATH(completion_review_ai_config_json, 'one', '$.keyId')
UNION ALL
SELECT 'execution_contracts.completion_review_rounds_json[*].id', COUNT(*)
FROM execution_contracts
WHERE JSON_VALID(completion_review_rounds_json) AND JSON_CONTAINS_PATH(completion_review_rounds_json, 'one', '$[*].id')
UNION ALL
SELECT 'execution_contracts.completion_review_rounds_json[*].review.id', COUNT(*)
FROM execution_contracts
WHERE JSON_VALID(completion_review_rounds_json) AND JSON_CONTAINS_PATH(completion_review_rounds_json, 'one', '$[*].review.id')
UNION ALL
SELECT 'execution_contracts.completion_review_rounds_json[*].clarification.id', COUNT(*)
FROM execution_contracts
WHERE JSON_VALID(completion_review_rounds_json) AND JSON_CONTAINS_PATH(completion_review_rounds_json, 'one', '$[*].clarification.id')
UNION ALL
SELECT 'execution_contracts.completion_review_rounds_json[*].aiConfig.keyId', COUNT(*)
FROM execution_contracts
WHERE JSON_VALID(completion_review_rounds_json) AND JSON_CONTAINS_PATH(completion_review_rounds_json, 'one', '$[*].aiConfig.keyId')
UNION ALL
SELECT 'execution_contracts.completion_review_rounds_json[*].review.aiConfig.keyId', COUNT(*)
FROM execution_contracts
WHERE JSON_VALID(completion_review_rounds_json) AND JSON_CONTAINS_PATH(completion_review_rounds_json, 'one', '$[*].review.aiConfig.keyId')
UNION ALL
SELECT 'node_conversations.latest_review_json.id', COUNT(*)
FROM node_conversations
WHERE JSON_VALID(latest_review_json) AND JSON_CONTAINS_PATH(latest_review_json, 'one', '$.id')
UNION ALL
SELECT 'node_conversations.ai_config_json.keyId', COUNT(*)
FROM node_conversations
WHERE JSON_VALID(ai_config_json) AND JSON_CONTAINS_PATH(ai_config_json, 'one', '$.keyId')
UNION ALL
SELECT 'collaboration_review_batches.ai_review_json.id', COUNT(*)
FROM collaboration_review_batches
WHERE JSON_VALID(ai_review_json) AND JSON_CONTAINS_PATH(ai_review_json, 'one', '$.id');
