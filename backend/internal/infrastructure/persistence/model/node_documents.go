// Package model 定义持久化模型。所有关联均为 UUID 标量，不声明 ORM 关联或数据库外键。
package model

import "time"

// NodeDocument 对应 action_node_documents，保存节点表达/约定草案、生成状态和当前发布版本。
// 表达和约定是节点自己的文档，不再通过继承状态解析。
type NodeDocument struct {
	ID               uint64    `gorm:"column:id;type:bigint unsigned;primaryKey;autoIncrement;not null;index:ix_node_documents_status,priority:2"`
	UUID             string    `gorm:"column:uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;uniqueIndex:uq_node_documents_uuid,priority:1"`
	GraphUUID        string    `gorm:"column:graph_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;index:ix_node_documents_graph,priority:1"`
	NodeUUID         string    `gorm:"column:node_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;uniqueIndex:uq_node_documents_node_kind,priority:1"`
	Kind             string    `gorm:"column:kind;type:varchar(16) CHARACTER SET ascii COLLATE ascii_bin;not null;uniqueIndex:uq_node_documents_node_kind,priority:2;check:ck_node_documents,(kind IN ('expression', 'agreement'))"`
	Status           string    `gorm:"column:status;type:varchar(12) CHARACTER SET ascii COLLATE ascii_bin;not null;default:'pending';index:ix_node_documents_status,priority:1;check:ck_node_documents_status,status IN ('pending', 'generating', 'draft', 'published', 'failed')"`
	DraftMarkdown    *string   `gorm:"column:draft_markdown;type:mediumtext;comment:AI 生成或修改后的待发布草案；发布后清空"`
	PublishedVersion *string   `gorm:"column:published_version_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;index:ix_node_documents_published,priority:1;comment:当前生效的 action_document_versions.uuid"`
	GenerationUUID   *string   `gorm:"column:generation_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;index:ix_node_documents_generation,priority:1;comment:最近一次 AI 生成任务，失败重试时替换"`
	ErrorCode        *string   `gorm:"column:error_code;type:varchar(64) CHARACTER SET ascii COLLATE ascii_bin"`
	ErrorMessage     *string   `gorm:"column:error_message;type:varchar(240) CHARACTER SET ascii COLLATE ascii_bin;comment:面向作者的简短失败原因，不存上游堆栈"`
	CreatedAt        time.Time `gorm:"column:created_at;type:datetime(6);not null;default:CURRENT_TIMESTAMP(6)"`
	UpdatedAt        time.Time `gorm:"column:updated_at;type:datetime(6);not null;default:CURRENT_TIMESTAMP(6)"`
}

// TableName 固定表名，避免依赖 ORM 复数推断。
func (NodeDocument) TableName() string { return "action_node_documents" }
