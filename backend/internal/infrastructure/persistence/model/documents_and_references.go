// Package model 定义持久化模型。所有关联均为 UUID 标量，不声明 ORM 关联或数据库外键。
package model

import "time"

// DocumentVersion 对应 action_document_versions，业务规则由 application 用例校验。
type DocumentVersion struct {
	ID                  uint64    `gorm:"column:id;type:bigint unsigned;primaryKey;autoIncrement;not null;index:ix_document_versions_actor,priority:4,sort:desc;check:ck_action_document_versions,(kind IN ('expression', 'agreement')) AND (revision_number > 0) AND ((mode = 'update' AND CHAR_LENGTH(TRIM(markdown)) > 0 AND change_kind IN ('initial', 'supplement', 'modify')) OR (mode = 'clear' AND OCTET_LENGTH(markdown) = 0 AND change_kind = 'clear'))"`
	UUID                string    `gorm:"column:uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;uniqueIndex:uq_document_versions_uuid,priority:1"`
	GraphUUID           string    `gorm:"column:graph_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;index:ix_document_versions_graph,priority:1"`
	NodeUUID            string    `gorm:"column:node_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;uniqueIndex:uq_document_versions_revision,priority:1;comment:明确写入或清空文档的节点，不是仅继承的节点"`
	Kind                string    `gorm:"column:kind;type:varchar(16) CHARACTER SET ascii COLLATE ascii_bin;not null;uniqueIndex:uq_document_versions_revision,priority:2;index:ix_document_versions_actor,priority:2"`
	RevisionNumber      uint32    `gorm:"column:revision_number;type:int unsigned;not null;uniqueIndex:uq_document_versions_revision,priority:3;comment:节点内同类文档的递增版本号"`
	Mode                string    `gorm:"column:mode;type:varchar(8) CHARACTER SET ascii COLLATE ascii_bin;not null;comment:版本本身只有 update 或 clear，继承不复制正文"`
	ChangeKind          string    `gorm:"column:change_kind;type:varchar(12) CHARACTER SET ascii COLLATE ascii_bin;not null"`
	Markdown            string    `gorm:"column:markdown;type:mediumtext;not null"`
	ActorUUID           string    `gorm:"column:actor_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;index:ix_document_versions_actor,priority:1;comment:确认这次整理或约定操作的用户，不表示多人协作功能"`
	GenerationUUID      *string   `gorm:"column:generation_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;index:ix_document_versions_generation,priority:1;comment:关联 ai_generations.uuid；手动约定不伪造 AI 对话"`
	PreviousVersionUUID *string   `gorm:"column:previous_version_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;index:ix_document_versions_previous,priority:1;comment:替换的有效版本，可来自主要承接链的祖先"`
	CreatedAt           time.Time `gorm:"column:created_at;type:datetime(6);not null;default:CURRENT_TIMESTAMP(6);index:ix_document_versions_actor,priority:3,sort:desc"`
}

// TableName 固定表名，避免依赖 ORM 复数推断。
func (DocumentVersion) TableName() string { return "action_document_versions" }

// DocumentState 对应 action_document_states，业务规则由 application 用例校验。
type DocumentState struct {
	ID                   uint64    `gorm:"column:id;type:bigint unsigned;primaryKey;autoIncrement;not null;check:ck_action_document_states,(kind IN ('expression', 'agreement')) AND ((mode = 'inherit' AND local_version_uuid IS NULL) OR (mode IN ('update', 'clear') AND local_version_uuid IS NOT NULL AND effective_version_uuid IS NOT NULL AND effective_version_uuid = local_version_uuid))"`
	GraphUUID            string    `gorm:"column:graph_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;index:ix_document_states_graph,priority:1"`
	NodeUUID             string    `gorm:"column:node_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;uniqueIndex:uq_document_states_node,priority:1"`
	Kind                 string    `gorm:"column:kind;type:varchar(16) CHARACTER SET ascii COLLATE ascii_bin;not null;uniqueIndex:uq_document_states_node,priority:2"`
	Mode                 string    `gorm:"column:mode;type:varchar(8) CHARACTER SET ascii COLLATE ascii_bin;not null"`
	LocalVersionUUID     *string   `gorm:"column:local_version_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;index:ix_document_states_local,priority:1;comment:本节点明确写入或清空的版本；inherit 时为空"`
	EffectiveVersionUUID *string   `gorm:"column:effective_version_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;index:ix_document_states_effective,priority:1;comment:解析后的当前版本；可指向 clear 版本，不能越过清空继续继承"`
	UpdatedAt            time.Time `gorm:"column:updated_at;type:datetime(6);not null;default:CURRENT_TIMESTAMP(6)"`
}

// TableName 固定表名，避免依赖 ORM 复数推断。
func (DocumentState) TableName() string { return "action_document_states" }

// ActionReference 对应 action_references，业务规则由 application 用例校验。
type ActionReference struct {
	ID                   uint64    `gorm:"column:id;type:bigint unsigned;primaryKey;autoIncrement;not null;index:ix_action_references_feed,priority:3,sort:desc;index:ix_action_references_graph_feed,priority:4,sort:desc;check:ck_action_references,(kind IN ('primary', 'merged')) AND (source_node_version > 0) AND (agreement_status IN ('unrestricted', 'unreviewed', 'satisfied', 'exception') AND (agreement_status = 'unrestricted' OR agreement_version_uuid IS NOT NULL)) AND ((agreement_status = 'exception' AND exception_reason IS NOT NULL AND CHAR_LENGTH(TRIM(exception_reason)) > 0) OR (agreement_status <> 'exception' AND exception_reason IS NULL))"`
	UUID                 string    `gorm:"column:uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;uniqueIndex:uq_action_references_uuid,priority:1"`
	GraphUUID            string    `gorm:"column:graph_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;index:ix_action_references_graph_feed,priority:1"`
	SourceNodeUUID       string    `gorm:"column:source_node_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;uniqueIndex:uq_action_references_edge,priority:2;index:ix_action_references_source,priority:1;comment:被引用的旧行动"`
	TargetNodeUUID       string    `gorm:"column:target_node_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;uniqueIndex:uq_action_references_edge,priority:1;uniqueIndex:uq_action_references_primary,priority:1;index:ix_action_references_source,priority:2;comment:本次发布的后续行动"`
	Kind                 string    `gorm:"column:kind;type:varchar(8) CHARACTER SET ascii COLLATE ascii_bin;not null"`
	PrimarySlot          *int8     `gorm:"column:primary_slot;type:tinyint GENERATED ALWAYS AS (CASE WHEN kind = 'primary' THEN 1 ELSE NULL END) STORED;->;uniqueIndex:uq_action_references_primary,priority:2"`
	SourceNodeVersion    uint32    `gorm:"column:source_node_version;type:int unsigned;not null;comment:本次发布实际采用的来源节点版本"`
	AgreementVersionUUID *string   `gorm:"column:agreement_version_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;index:ix_action_references_agreement,priority:1;comment:固定采用的来源约定版本，包括可能的 clear 版本"`
	AgreementStatus      string    `gorm:"column:agreement_status;type:varchar(16) CHARACTER SET ascii COLLATE ascii_bin;not null;index:ix_action_references_feed,priority:1;index:ix_action_references_graph_feed,priority:2;comment:无约定、未知、满足、不满足四态"`
	ExceptionReason      *string   `gorm:"column:exception_reason;type:text"`
	CreatedAt            time.Time `gorm:"column:created_at;type:datetime(6);not null;default:CURRENT_TIMESTAMP(6);index:ix_action_references_feed,priority:2,sort:desc;index:ix_action_references_graph_feed,priority:3,sort:desc"`
}

// TableName 固定表名，避免依赖 ORM 复数推断。
func (ActionReference) TableName() string { return "action_references" }
