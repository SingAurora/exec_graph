-- 将历史审查 JSON 的资源标识键从 id/keyId 一次性迁移为 uuid/keyUuid。
-- 验收标准使用的 criterionId 是业务编号，不在本次迁移范围内。

UPDATE execution_contracts
SET draft_review_json = JSON_SET(
    JSON_REMOVE(draft_review_json, '$.id'),
    '$.uuid', UUID()
)
WHERE JSON_VALID(draft_review_json)
  AND JSON_CONTAINS_PATH(draft_review_json, 'one', '$.id');

UPDATE execution_contracts
SET draft_review_json = JSON_SET(
    JSON_REMOVE(draft_review_json, '$.aiConfig.keyId'),
    '$.aiConfig.keyUuid', JSON_EXTRACT(draft_review_json, '$.aiConfig.keyId')
)
WHERE JSON_VALID(draft_review_json)
  AND JSON_CONTAINS_PATH(draft_review_json, 'one', '$.aiConfig.keyId');

UPDATE execution_contracts
SET draft_review_ai_config_json = JSON_SET(
    JSON_REMOVE(draft_review_ai_config_json, '$.keyId'),
    '$.keyUuid', JSON_EXTRACT(draft_review_ai_config_json, '$.keyId')
)
WHERE JSON_VALID(draft_review_ai_config_json)
  AND JSON_CONTAINS_PATH(draft_review_ai_config_json, 'one', '$.keyId');

SET SESSION group_concat_max_len = 16777216;

CREATE TEMPORARY TABLE _exec_graph_review_messages_uuid_keys (
    node_id BIGINT UNSIGNED PRIMARY KEY,
    messages_json LONGTEXT NOT NULL
);

INSERT INTO _exec_graph_review_messages_uuid_keys (node_id, messages_json)
SELECT node.id,
       CONCAT(
           '[',
           GROUP_CONCAT(
               JSON_SET(JSON_REMOVE(message_value.message, '$.id'), '$.uuid', UUID())
               ORDER BY message_value.position SEPARATOR ','
           ),
           ']'
       )
FROM execution_contracts AS node
JOIN JSON_TABLE(
    node.review_messages_json,
    '$[*]' COLUMNS (
        position FOR ORDINALITY,
        message JSON PATH '$'
    )
) AS message_value
WHERE JSON_VALID(node.review_messages_json)
  AND JSON_CONTAINS_PATH(node.review_messages_json, 'one', '$[*].id')
GROUP BY node.id;

UPDATE execution_contracts AS node
JOIN _exec_graph_review_messages_uuid_keys AS migrated ON migrated.node_id = node.id
SET node.review_messages_json = migrated.messages_json;

DROP TEMPORARY TABLE _exec_graph_review_messages_uuid_keys;

UPDATE execution_contracts
SET ai_review_json = JSON_SET(
    JSON_REMOVE(ai_review_json, '$.id'),
    '$.uuid', UUID()
)
WHERE JSON_VALID(ai_review_json)
  AND JSON_CONTAINS_PATH(ai_review_json, 'one', '$.id');

UPDATE execution_contracts
SET ai_review_json = JSON_SET(
    JSON_REMOVE(ai_review_json, '$.aiConfig.keyId'),
    '$.aiConfig.keyUuid', JSON_EXTRACT(ai_review_json, '$.aiConfig.keyId')
)
WHERE JSON_VALID(ai_review_json)
  AND JSON_CONTAINS_PATH(ai_review_json, 'one', '$.aiConfig.keyId');

UPDATE execution_contracts
SET completion_review_ai_config_json = JSON_SET(
    JSON_REMOVE(completion_review_ai_config_json, '$.keyId'),
    '$.keyUuid', JSON_EXTRACT(completion_review_ai_config_json, '$.keyId')
)
WHERE JSON_VALID(completion_review_ai_config_json)
  AND JSON_CONTAINS_PATH(completion_review_ai_config_json, 'one', '$.keyId');

CREATE TEMPORARY TABLE _exec_graph_review_round_uuid_keys (
    node_id BIGINT UNSIGNED NOT NULL,
    position INT UNSIGNED NOT NULL,
    round_json JSON NOT NULL,
    PRIMARY KEY (node_id, position)
);

INSERT INTO _exec_graph_review_round_uuid_keys (node_id, position, round_json)
SELECT node.id, round_value.position, round_value.round_json
FROM execution_contracts AS node
JOIN JSON_TABLE(
    node.completion_review_rounds_json,
    '$[*]' COLUMNS (
        position FOR ORDINALITY,
        round_json JSON PATH '$'
    )
) AS round_value
WHERE JSON_VALID(node.completion_review_rounds_json)
  AND (
      JSON_CONTAINS_PATH(node.completion_review_rounds_json, 'one', '$[*].id')
      OR JSON_CONTAINS_PATH(node.completion_review_rounds_json, 'one', '$[*].review.id')
      OR JSON_CONTAINS_PATH(node.completion_review_rounds_json, 'one', '$[*].clarification.id')
      OR JSON_CONTAINS_PATH(node.completion_review_rounds_json, 'one', '$[*].aiConfig.keyId')
      OR JSON_CONTAINS_PATH(node.completion_review_rounds_json, 'one', '$[*].review.aiConfig.keyId')
  );

UPDATE _exec_graph_review_round_uuid_keys
SET round_json = JSON_SET(JSON_REMOVE(round_json, '$.id'), '$.uuid', UUID())
WHERE JSON_CONTAINS_PATH(round_json, 'one', '$.id');

UPDATE _exec_graph_review_round_uuid_keys
SET round_json = JSON_SET(JSON_REMOVE(round_json, '$.review.id'), '$.review.uuid', UUID())
WHERE JSON_CONTAINS_PATH(round_json, 'one', '$.review.id');

UPDATE _exec_graph_review_round_uuid_keys
SET round_json = JSON_SET(JSON_REMOVE(round_json, '$.clarification.id'), '$.clarification.uuid', UUID())
WHERE JSON_CONTAINS_PATH(round_json, 'one', '$.clarification.id');

UPDATE _exec_graph_review_round_uuid_keys
SET round_json = JSON_SET(
    JSON_REMOVE(round_json, '$.aiConfig.keyId'),
    '$.aiConfig.keyUuid', JSON_EXTRACT(round_json, '$.aiConfig.keyId')
)
WHERE JSON_CONTAINS_PATH(round_json, 'one', '$.aiConfig.keyId');

UPDATE _exec_graph_review_round_uuid_keys
SET round_json = JSON_SET(
    JSON_REMOVE(round_json, '$.review.aiConfig.keyId'),
    '$.review.aiConfig.keyUuid', JSON_EXTRACT(round_json, '$.review.aiConfig.keyId')
)
WHERE JSON_CONTAINS_PATH(round_json, 'one', '$.review.aiConfig.keyId');

CREATE TEMPORARY TABLE _exec_graph_review_round_arrays (
    node_id BIGINT UNSIGNED PRIMARY KEY,
    rounds_json LONGTEXT NOT NULL
);

INSERT INTO _exec_graph_review_round_arrays (node_id, rounds_json)
SELECT node_id,
       CONCAT('[', GROUP_CONCAT(round_json ORDER BY position SEPARATOR ','), ']')
FROM _exec_graph_review_round_uuid_keys
GROUP BY node_id;

UPDATE execution_contracts AS node
JOIN _exec_graph_review_round_arrays AS migrated ON migrated.node_id = node.id
SET node.completion_review_rounds_json = migrated.rounds_json;

DROP TEMPORARY TABLE _exec_graph_review_round_arrays;
DROP TEMPORARY TABLE _exec_graph_review_round_uuid_keys;

UPDATE node_conversations
SET latest_review_json = JSON_SET(
    JSON_REMOVE(latest_review_json, '$.id'),
    '$.uuid', UUID()
)
WHERE JSON_VALID(latest_review_json)
  AND JSON_CONTAINS_PATH(latest_review_json, 'one', '$.id');

UPDATE node_conversations
SET ai_config_json = JSON_SET(
    JSON_REMOVE(ai_config_json, '$.keyId'),
    '$.keyUuid', JSON_EXTRACT(ai_config_json, '$.keyId')
)
WHERE JSON_VALID(ai_config_json)
  AND JSON_CONTAINS_PATH(ai_config_json, 'one', '$.keyId');

UPDATE collaboration_review_batches
SET ai_review_json = JSON_SET(
    JSON_REMOVE(ai_review_json, '$.id'),
    '$.uuid', UUID()
)
WHERE JSON_VALID(ai_review_json)
  AND JSON_CONTAINS_PATH(ai_review_json, 'one', '$.id');

UPDATE collaboration_review_batches
SET ai_review_json = JSON_SET(
    JSON_REMOVE(ai_review_json, '$.aiConfig.keyId'),
    '$.aiConfig.keyUuid', JSON_EXTRACT(ai_review_json, '$.aiConfig.keyId')
)
WHERE JSON_VALID(ai_review_json)
  AND JSON_CONTAINS_PATH(ai_review_json, 'one', '$.aiConfig.keyId');
