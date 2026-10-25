// Package model 定义持久化模型。所有关联均为 UUID 标量，不声明 ORM 关联或数据库外键。
package model

import "time"

// AIConversation 对应 ai_conversations，业务规则由 application 用例校验。
type AIConversation struct {
	ID                       uint64    `gorm:"column:id;type:bigint unsigned;primaryKey;autoIncrement;not null;index:ix_ai_conversations_owner,priority:3;check:ck_ai_conversations,((node_uuid IS NULL AND published_through_sequence IS NULL) OR (node_uuid IS NOT NULL AND published_through_sequence IS NOT NULL AND published_through_sequence > 0 AND published_through_sequence < next_message_sequence)) AND (next_message_sequence > 0 AND version > 0)"`
	UUID                     string    `gorm:"column:uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;uniqueIndex:uq_ai_conversations_uuid,priority:1"`
	GraphUUID                string    `gorm:"column:graph_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;index:ix_ai_conversations_graph,priority:1"`
	OwnerUUID                string    `gorm:"column:owner_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;index:ix_ai_conversations_owner,priority:1"`
	NodeUUID                 *string   `gorm:"column:node_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;uniqueIndex:uq_ai_conversations_node,priority:1;comment:行动发布前为空，发布后关联唯一节点，后续表达仍延续本对话"`
	PublishedThroughSequence *uint32   `gorm:"column:published_through_sequence;type:int unsigned;comment:第一次发布的原始对话边界，后续消息不改写原始对话"`
	NextMessageSequence      uint32    `gorm:"column:next_message_sequence;type:int unsigned;not null;default:1;comment:锁定对话行后分配，消息序号不可重用"`
	Version                  uint32    `gorm:"column:version;type:int unsigned;not null;default:1"`
	CreatedAt                time.Time `gorm:"column:created_at;type:datetime(6);not null;default:CURRENT_TIMESTAMP(6)"`
	UpdatedAt                time.Time `gorm:"column:updated_at;type:datetime(6);not null;default:CURRENT_TIMESTAMP(6);index:ix_ai_conversations_owner,priority:2"`
}

// TableName 固定表名，避免依赖 ORM 复数推断。
func (AIConversation) TableName() string { return "ai_conversations" }

// AIMessage 对应 ai_messages，业务规则由 application 用例校验。
type AIMessage struct {
	ID               uint64     `gorm:"column:id;type:bigint unsigned;primaryKey;autoIncrement;not null;check:ck_ai_messages,(sequence_number > 0) AND ((speaker = 'user' AND author_uuid IS NOT NULL) OR (speaker = 'ai' AND author_uuid IS NULL)) AND (CHAR_LENGTH(TRIM(body)) > 0)"`
	UUID             string     `gorm:"column:uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;uniqueIndex:uq_ai_messages_uuid,priority:1"`
	ConversationUUID string     `gorm:"column:conversation_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;uniqueIndex:uq_ai_messages_sequence,priority:1"`
	SequenceNumber   uint32     `gorm:"column:sequence_number;type:int unsigned;not null;uniqueIndex:uq_ai_messages_sequence,priority:2"`
	Speaker          string     `gorm:"column:speaker;type:varchar(8) CHARACTER SET ascii COLLATE ascii_bin;not null"`
	AuthorUUID       *string    `gorm:"column:author_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;index:ix_ai_messages_author,priority:1;comment:user 消息记录实际用户，ai 消息为空"`
	Body             string     `gorm:"column:body;type:mediumtext;not null;comment:实际用户输入或 AI 简短回复，不存欢迎语和错误占位消息"`
	ConfirmedAt      *time.Time `gorm:"column:confirmed_at;type:datetime(6);comment:只有被用户确认的生成所使用的消息才进入公开形成过程"`
	CreatedAt        time.Time  `gorm:"column:created_at;type:datetime(6);not null;default:CURRENT_TIMESTAMP(6)"`
}

// TableName 固定表名，避免依赖 ORM 复数推断。
func (AIMessage) TableName() string { return "ai_messages" }

// AIGeneration 对应 ai_generations，业务规则由 application 用例校验。
type AIGeneration struct {
	ID                             uint64     `gorm:"column:id;type:bigint unsigned;primaryKey;autoIncrement;not null;index:ix_ai_generations_history,priority:3;index:ix_ai_generations_pending,priority:3;check:ck_ai_generations,((mode = 'action' AND base_node_version IS NULL) OR (mode = 'expression' AND base_node_version IS NOT NULL AND base_node_version > 0)) AND ((downstream_agreement_mode = 'inherit' AND downstream_agreement_markdown IS NULL) OR (downstream_agreement_mode = 'clear' AND downstream_agreement_markdown IS NOT NULL AND OCTET_LENGTH(downstream_agreement_markdown) = 0) OR (downstream_agreement_mode = 'update' AND downstream_agreement_markdown IS NOT NULL AND CHAR_LENGTH(TRIM(downstream_agreement_markdown)) > 0)) AND ((status = 'pending' AND completed_at IS NULL AND confirmed_at IS NULL AND error_code IS NULL AND output_message_uuid IS NULL) OR (status = 'succeeded' AND completed_at IS NOT NULL AND error_code IS NULL AND output_message_uuid IS NOT NULL AND expression_mode IS NOT NULL AND expression_markdown IS NOT NULL) OR (status IN ('failed', 'cancelled') AND completed_at IS NOT NULL AND confirmed_at IS NULL AND output_message_uuid IS NULL)) AND (expression_mode IS NULL OR (expression_mode IN ('inherit', 'clear') AND expression_markdown IS NOT NULL AND OCTET_LENGTH(expression_markdown) = 0) OR (expression_mode = 'update' AND expression_markdown IS NOT NULL AND CHAR_LENGTH(TRIM(expression_markdown)) > 0)) AND (status <> 'succeeded' OR mode <> 'action' OR (generated_title IS NOT NULL AND CHAR_LENGTH(TRIM(generated_title)) > 0 AND objective_markdown IS NOT NULL AND CHAR_LENGTH(TRIM(objective_markdown)) > 0)) AND (mode <> 'expression' OR expression_mode IS NULL OR expression_mode <> 'inherit')"`
	UUID                           string     `gorm:"column:uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;uniqueIndex:uq_ai_generations_uuid,priority:1"`
	ConversationUUID               string     `gorm:"column:conversation_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;uniqueIndex:uq_ai_generations_request,priority:1;uniqueIndex:uq_ai_generations_pending,priority:1;index:ix_ai_generations_history,priority:1"`
	GraphUUID                      string     `gorm:"column:graph_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;index:ix_ai_generations_graph,priority:1"`
	RequestedByUUID                string     `gorm:"column:requested_by_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;index:ix_ai_generations_requester,priority:1;comment:本轮真实发起者；对话创建者不自动决定后续操作权限"`
	RequestKey                     string     `gorm:"column:request_key;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;uniqueIndex:uq_ai_generations_request,priority:2;comment:单次生成请求的幂等标识"`
	Mode                           string     `gorm:"column:mode;type:varchar(12) CHARACTER SET ascii COLLATE ascii_bin;not null"`
	Status                         string     `gorm:"column:status;type:varchar(12) CHARACTER SET ascii COLLATE ascii_bin;not null;default:'pending';index:ix_ai_generations_pending,priority:1"`
	PendingSlot                    *int8      `gorm:"column:pending_slot;type:tinyint GENERATED ALWAYS AS (CASE WHEN status = 'pending' THEN 1 ELSE NULL END) STORED;->;uniqueIndex:uq_ai_generations_pending,priority:2"`
	InputThroughSequence           uint32     `gorm:"column:input_through_sequence;type:int unsigned;not null;comment:本轮请求包含的最后一条 user 消息；具体角色由应用验证"`
	OutputMessageUUID              *string    `gorm:"column:output_message_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;uniqueIndex:uq_ai_generations_output,priority:1;comment:成功后写入的 ai 回复，必须属于同一对话"`
	BaseNodeVersion                *uint32    `gorm:"column:base_node_version;type:int unsigned;comment:expression 模式必须提供，action 模式为空"`
	InheritedExpressionVersionUUID *string    `gorm:"column:inherited_expression_version_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;index:ix_ai_generations_inherited,priority:1;comment:本轮主要承接表达版本，类型和来源由应用验证"`
	DownstreamAgreementMode        string     `gorm:"column:downstream_agreement_mode;type:varchar(8) CHARACTER SET ascii COLLATE ascii_bin;not null"`
	DownstreamAgreementMarkdown    *string    `gorm:"column:downstream_agreement_markdown;type:mediumtext;comment:本轮向后约定草稿，区别于来源约定核对"`
	ContextGuideSnapshot           string     `gorm:"column:context_guide_snapshot;type:text;not null"`
	ContextSHA256                  []byte     `gorm:"column:context_sha256;type:binary(32);not null;comment:规范化后的来源、版本、指引、用户输入及草稿签名"`
	Model                          string     `gorm:"column:model;type:varchar(100) CHARACTER SET ascii COLLATE ascii_bin;not null"`
	PromptVersion                  string     `gorm:"column:prompt_version;type:varchar(32) CHARACTER SET ascii COLLATE ascii_bin;not null"`
	GeneratedTitle                 *string    `gorm:"column:generated_title;type:varchar(200)"`
	ObjectiveMarkdown              *string    `gorm:"column:objective_markdown;type:mediumtext;comment:只有 action 生成提供行动文稿"`
	ExpressionMode                 *string    `gorm:"column:expression_mode;type:varchar(8) CHARACTER SET ascii COLLATE ascii_bin"`
	ExpressionMarkdown             *string    `gorm:"column:expression_markdown;type:mediumtext"`
	InputTokens                    *uint32    `gorm:"column:input_tokens;type:int unsigned"`
	OutputTokens                   *uint32    `gorm:"column:output_tokens;type:int unsigned"`
	ErrorCode                      *string    `gorm:"column:error_code;type:varchar(64) CHARACTER SET ascii COLLATE ascii_bin;comment:诊断分类，不存密钥或上游堆栈"`
	CreatedAt                      time.Time  `gorm:"column:created_at;type:datetime(6);not null;default:CURRENT_TIMESTAMP(6);index:ix_ai_generations_history,priority:2;index:ix_ai_generations_pending,priority:2"`
	CompletedAt                    *time.Time `gorm:"column:completed_at;type:datetime(6)"`
	ConfirmedAt                    *time.Time `gorm:"column:confirmed_at;type:datetime(6);comment:用户确认后才能成为公开事实，失败或未确认的生成不公开"`
}

// TableName 固定表名，避免依赖 ORM 复数推断。
func (AIGeneration) TableName() string { return "ai_generations" }

// GenerationMessage 对应 ai_generation_messages，业务规则由 application 用例校验。
type GenerationMessage struct {
	ID               uint64 `gorm:"column:id;type:bigint unsigned;primaryKey;autoIncrement;not null;check:ck_ai_generation_messages,(position > 0)"`
	ConversationUUID string `gorm:"column:conversation_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;index:ix_generation_messages_conversation,priority:1"`
	GenerationUUID   string `gorm:"column:generation_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;uniqueIndex:uq_generation_messages_position,priority:1;uniqueIndex:uq_generation_messages_message,priority:1"`
	MessageUUID      string `gorm:"column:message_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;uniqueIndex:uq_generation_messages_message,priority:2;index:ix_generation_messages_message,priority:1"`
	Position         uint32 `gorm:"column:position;type:int unsigned;not null;uniqueIndex:uq_generation_messages_position,priority:2;comment:本轮实际发给模型的 user/ai 消息顺序，不含 system 提示"`
}

// TableName 固定表名，避免依赖 ORM 复数推断。
func (GenerationMessage) TableName() string { return "ai_generation_messages" }

// GenerationSource 对应 ai_generation_sources，业务规则由 application 用例校验。
type GenerationSource struct {
	ID                          uint64  `gorm:"column:id;type:bigint unsigned;primaryKey;autoIncrement;not null;check:ck_ai_generation_sources,(kind IN ('primary', 'merged')) AND (source_node_version > 0) AND (complies IS NULL OR complies IN (0, 1)) AND ((complies IS NOT NULL AND complies = 0 AND exception_reason IS NOT NULL AND CHAR_LENGTH(TRIM(exception_reason)) > 0) OR ((complies IS NULL OR complies = 1) AND exception_reason IS NULL))"`
	GraphUUID                   string  `gorm:"column:graph_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;index:ix_generation_sources_graph,priority:1"`
	GenerationUUID              string  `gorm:"column:generation_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;uniqueIndex:uq_generation_sources_node,priority:1;uniqueIndex:uq_generation_sources_primary,priority:1"`
	SourceNodeUUID              string  `gorm:"column:source_node_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;uniqueIndex:uq_generation_sources_node,priority:2;index:ix_generation_sources_node,priority:1"`
	SourceNodeVersion           uint32  `gorm:"column:source_node_version;type:int unsigned;not null"`
	Kind                        string  `gorm:"column:kind;type:varchar(8) CHARACTER SET ascii COLLATE ascii_bin;not null"`
	PrimarySlot                 *int8   `gorm:"column:primary_slot;type:tinyint GENERATED ALWAYS AS (CASE WHEN kind = 'primary' THEN 1 ELSE NULL END) STORED;->;uniqueIndex:uq_generation_sources_primary,priority:2"`
	SourceExpressionVersionUUID *string `gorm:"column:source_expression_version_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;index:ix_generation_sources_expression,priority:1;comment:固定本轮读取版本，不以事后最新文档重建生成请求"`
	SourceAgreementVersionUUID  *string `gorm:"column:source_agreement_version_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;index:ix_generation_sources_agreement,priority:1"`
	Complies                    *uint8  `gorm:"column:complies;type:tinyint unsigned;comment:NULL 未核对，1 满足，0 不满足；无约定仍需由应用识别"`
	ExceptionReason             *string `gorm:"column:exception_reason;type:text"`
}

// TableName 固定表名，避免依赖 ORM 复数推断。
func (GenerationSource) TableName() string { return "ai_generation_sources" }
