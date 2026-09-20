-- 将历史项目的带前缀公开标识一次性替换为标准 UUID。
-- 项目关系已经使用自增 id，因此这里不修改任何内部外键。

UPDATE projects
SET uuid = LOWER(CONCAT(
    HEX(RANDOM_BYTES(4)), '-',
    HEX(RANDOM_BYTES(2)), '-',
    '4', SUBSTRING(HEX(RANDOM_BYTES(2)), 2, 3), '-',
    '8', SUBSTRING(HEX(RANDOM_BYTES(2)), 2, 3), '-',
    HEX(RANDOM_BYTES(6))
))
WHERE uuid NOT REGEXP '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$';

SELECT COUNT(*) AS invalid_project_uuid_count
FROM projects
WHERE uuid NOT REGEXP '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$';
