// Package model 定义持久化模型。所有关联均为 UUID 标量，不声明 ORM 关联或数据库外键。
package model

import "time"

// UserFollow 对应 user_follows，业务规则由 application 用例校验。
type UserFollow struct {
	ID               uint64    `gorm:"column:id;type:bigint unsigned;primaryKey;autoIncrement;not null;check:ck_user_follows,(follower_uuid <> followed_user_uuid)"`
	FollowerUUID     string    `gorm:"column:follower_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;uniqueIndex:uq_user_follows_pair,priority:1;index:ix_user_follows_reverse,priority:2"`
	FollowedUserUUID string    `gorm:"column:followed_user_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;uniqueIndex:uq_user_follows_pair,priority:2;index:ix_user_follows_reverse,priority:1"`
	CreatedAt        time.Time `gorm:"column:created_at;type:datetime(6);not null;default:CURRENT_TIMESTAMP(6)"`
}

// TableName 固定表名，避免依赖 ORM 复数推断。
func (UserFollow) TableName() string { return "user_follows" }

// GraphFollow 对应 graph_follows，业务规则由 application 用例校验。
type GraphFollow struct {
	ID        uint64    `gorm:"column:id;type:bigint unsigned;primaryKey;autoIncrement;not null"`
	UserUUID  string    `gorm:"column:user_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;uniqueIndex:uq_graph_follows_pair,priority:1;index:ix_graph_follows_reverse,priority:2"`
	GraphUUID string    `gorm:"column:graph_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;uniqueIndex:uq_graph_follows_pair,priority:2;index:ix_graph_follows_reverse,priority:1"`
	CreatedAt time.Time `gorm:"column:created_at;type:datetime(6);not null;default:CURRENT_TIMESTAMP(6)"`
}

// TableName 固定表名，避免依赖 ORM 复数推断。
func (GraphFollow) TableName() string { return "graph_follows" }

// ProfileHighlight 对应 profile_highlights，业务规则由 application 用例校验。
type ProfileHighlight struct {
	ID        uint64    `gorm:"column:id;type:bigint unsigned;primaryKey;autoIncrement;not null;check:ck_profile_highlights,(position BETWEEN 1 AND 5)"`
	UserUUID  string    `gorm:"column:user_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;uniqueIndex:uq_profile_highlights_node,priority:1;uniqueIndex:uq_profile_highlights_position,priority:1"`
	NodeUUID  string    `gorm:"column:node_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;uniqueIndex:uq_profile_highlights_node,priority:2;index:ix_profile_highlights_node,priority:1;comment:选择具体表达分支，不自动移动到后续节点"`
	Position  uint8     `gorm:"column:position;type:tinyint unsigned;not null;uniqueIndex:uq_profile_highlights_position,priority:2;comment:1 到 5，顺序只在集中管理确认保存后改变"`
	CreatedAt time.Time `gorm:"column:created_at;type:datetime(6);not null;default:CURRENT_TIMESTAMP(6)"`
}

// TableName 固定表名，避免依赖 ORM 复数推断。
func (ProfileHighlight) TableName() string { return "profile_highlights" }

// IdempotencyRecord 对应 idempotency_records，业务规则由 application 用例校验。
type IdempotencyRecord struct {
	ID                 uint64    `gorm:"column:id;type:bigint unsigned;primaryKey;autoIncrement;not null;index:ix_idempotency_expiry,priority:2;check:ck_idempotency_records,((status = 'processing' AND response_http_status IS NULL AND response_json IS NULL) OR (status = 'succeeded' AND response_http_status IS NOT NULL AND response_http_status = 200 AND response_json IS NOT NULL)) AND (expires_at > created_at)"`
	UserUUID           string    `gorm:"column:user_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;uniqueIndex:uq_idempotency_scope,priority:1"`
	Command            string    `gorm:"column:command;type:varchar(96) CHARACTER SET ascii COLLATE ascii_bin;not null;uniqueIndex:uq_idempotency_scope,priority:2;comment:例如 graphs/create 或 actions/create"`
	RequestKey         string    `gorm:"column:request_key;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;uniqueIndex:uq_idempotency_scope,priority:3"`
	RequestSHA256      []byte    `gorm:"column:request_sha256;type:binary(32);not null;comment:明确 DTO 规范化后的指纹，不对原始 JSON 字节直接比较"`
	Status             string    `gorm:"column:status;type:varchar(12) CHARACTER SET ascii COLLATE ascii_bin;not null;default:'processing'"`
	ResponseHTTPStatus *uint16   `gorm:"column:response_http_status;type:smallint unsigned"`
	ResponseJSON       []byte    `gorm:"column:response_json;type:json;comment:不同命令的已确认公开响应快照，唯一使用动态业务响应 JSON 的位置"`
	CreatedAt          time.Time `gorm:"column:created_at;type:datetime(6);not null;default:CURRENT_TIMESTAMP(6)"`
	ExpiresAt          time.Time `gorm:"column:expires_at;type:datetime(6);not null;index:ix_idempotency_expiry,priority:1;comment:至少保留 24 小时；过期记录由维护任务清理"`
}

// TableName 固定表名，避免依赖 ORM 复数推断。
func (IdempotencyRecord) TableName() string { return "idempotency_records" }
