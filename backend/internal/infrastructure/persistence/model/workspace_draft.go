package model

import "time"

// WorkspaceDraft 是账号在某个工作区目标下的一份云端草稿。
type WorkspaceDraft struct {
	ID             uint64    `gorm:"column:id;type:bigint unsigned;primaryKey;autoIncrement;not null"`
	UUID           string    `gorm:"column:uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;uniqueIndex:uq_workspace_drafts_uuid,priority:1"`
	OwnerUUID      string    `gorm:"column:owner_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;uniqueIndex:uq_workspace_drafts_scope,priority:1"`
	ScopeKey       string    `gorm:"column:scope_key;type:varchar(200);not null;uniqueIndex:uq_workspace_drafts_scope,priority:2"`
	WorkspaceType  string    `gorm:"column:workspace_type;type:varchar(16) CHARACTER SET ascii COLLATE ascii_bin;not null"`
	GraphUUID      string    `gorm:"column:graph_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null"`
	NodeUUID       *string   `gorm:"column:node_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin"`
	ParentUUID     *string   `gorm:"column:parent_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin"`
	Payload        []byte    `gorm:"column:payload;type:json;not null"`
	Version        uint32    `gorm:"column:version;type:int unsigned;not null;default:1"`
	LastAccessedAt time.Time `gorm:"column:last_accessed_at;type:datetime(6);not null;index:ix_workspace_drafts_expiry"`
	CreatedAt      time.Time `gorm:"column:created_at;type:datetime(6);not null;default:CURRENT_TIMESTAMP(6)"`
	UpdatedAt      time.Time `gorm:"column:updated_at;type:datetime(6);not null;default:CURRENT_TIMESTAMP(6)"`
}

// TableName 固定表名。
func (WorkspaceDraft) TableName() string { return "workspace_drafts" }
