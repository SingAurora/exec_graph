// Package model 定义持久化模型。所有关联均为 UUID 标量，不声明 ORM 关联或数据库外键。
package model

import "time"

// Graph 对应 graphs，业务规则由 application 用例校验。
type Graph struct {
	ID              uint64     `gorm:"column:id;type:bigint unsigned;primaryKey;autoIncrement;not null;index:ix_graphs_owner,priority:4;index:ix_graphs_directory,priority:3;check:ck_graphs,(CHAR_LENGTH(TRIM(title)) > 0) AND (version > 0) AND (next_node_number > 0)"`
	UUID            string     `gorm:"column:uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;uniqueIndex:uq_graphs_uuid,priority:1"`
	OwnerUUID       string     `gorm:"column:owner_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;index:ix_graphs_owner,priority:1"`
	Title           string     `gorm:"column:title;type:varchar(60);not null"`
	Description     string     `gorm:"column:description;type:varchar(240);not null"`
	AvatarAssetUUID *string    `gorm:"column:avatar_asset_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;index:ix_graphs_avatar,priority:1"`
	CoverAssetUUID  *string    `gorm:"column:cover_asset_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;index:ix_graphs_cover,priority:1"`
	ContextGuide    string     `gorm:"column:context_guide;type:text;not null;comment:当前 AI 整理指引，发布时另存当时版本"`
	NextNodeNumber  uint32     `gorm:"column:next_node_number;type:int unsigned;not null;default:1;comment:持有图行锁后分配，禁止用 MAX(number)+1"`
	Version         uint32     `gorm:"column:version;type:int unsigned;not null;default:1;comment:图资料版本；节点计数仍需在删除事务中重查"`
	CreatedAt       time.Time  `gorm:"column:created_at;type:datetime(6);not null;default:CURRENT_TIMESTAMP(6);index:ix_graphs_owner,priority:3;index:ix_graphs_directory,priority:2"`
	UpdatedAt       time.Time  `gorm:"column:updated_at;type:datetime(6);not null;default:CURRENT_TIMESTAMP(6);comment:图资料更新时间，不作为最近行动时间"`
	DeletedAt       *time.Time `gorm:"column:deleted_at;type:datetime(6);index:ix_graphs_owner,priority:2;index:ix_graphs_directory,priority:1;comment:通过业务删除检查后逻辑删除，不级联抹除历史"`
}

// TableName 固定表名，避免依赖 ORM 复数推断。
func (Graph) TableName() string { return "graphs" }

// ActionNode 对应 action_nodes，业务规则由 application 用例校验。
type ActionNode struct {
	ID                   uint64    `gorm:"column:id;type:bigint unsigned;primaryKey;autoIncrement;not null;index:ix_action_nodes_graph_time,priority:3,sort:desc;index:ix_action_nodes_author_time,priority:3,sort:desc;index:ix_action_nodes_graph_author,priority:4;check:ck_action_nodes,(node_number > 0) AND (is_root IN (0, 1) AND (is_root = 0 OR (node_number = 1 AND node_level = 1 AND history_node_count = 0))) AND (CHAR_LENGTH(TRIM(title)) > 0) AND (CHAR_LENGTH(TRIM(objective_markdown)) > 0) AND (node_level > 0) AND (version > 0)"`
	UUID                 string    `gorm:"column:uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;uniqueIndex:uq_action_nodes_uuid,priority:1"`
	GraphUUID            string    `gorm:"column:graph_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;uniqueIndex:uq_action_nodes_number,priority:1;index:ix_action_nodes_graph_time,priority:1;index:ix_action_nodes_graph_author,priority:1"`
	NodeNumber           uint32    `gorm:"column:node_number;type:int unsigned;not null;uniqueIndex:uq_action_nodes_number,priority:2;comment:图内稳定展示编号，和层级分开"`
	IsRoot               uint8     `gorm:"column:is_root;type:tinyint unsigned;not null;comment:首次行动为 1；引用是否完整由发布事务检查"`
	RootGraphUUID        *string   `gorm:"column:root_graph_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin GENERATED ALWAYS AS (CASE WHEN is_root = 1 THEN graph_uuid ELSE NULL END) STORED;->;uniqueIndex:uq_action_nodes_root,priority:1"`
	AuthorUUID           string    `gorm:"column:author_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;index:ix_action_nodes_author_time,priority:1;index:ix_action_nodes_graph_author,priority:2;comment:实际行动者，不随表达整理改变"`
	Title                string    `gorm:"column:title;type:varchar(200);not null;comment:首版建议上限，接入时同步前端校验"`
	ObjectiveMarkdown    string    `gorm:"column:objective_markdown;type:mediumtext;not null;comment:已发布行动事实；V1 不提供通用正文编辑接口"`
	ContextGuideSnapshot string    `gorm:"column:context_guide_snapshot;type:text;not null;comment:发布整理时采用的图级指引"`
	HistoryNodeCount     uint32    `gorm:"column:history_node_count;type:int unsigned;not null;comment:全部直接来源的历史并集数量，不含本节点"`
	NodeLevel            uint32    `gorm:"column:node_level;type:int unsigned;not null;comment:所有直接来源最大层级加一，可由关系重建"`
	Version              uint32    `gorm:"column:version;type:int unsigned;not null;default:1;comment:表达或约定确认更新后递增"`
	CreatedAt            time.Time `gorm:"column:created_at;type:datetime(6);not null;default:CURRENT_TIMESTAMP(6);index:ix_action_nodes_graph_time,priority:2,sort:desc;index:ix_action_nodes_author_time,priority:2,sort:desc;index:ix_action_nodes_graph_author,priority:3"`
	UpdatedAt            time.Time `gorm:"column:updated_at;type:datetime(6);not null;default:CURRENT_TIMESTAMP(6)"`
}

// TableName 固定表名，避免依赖 ORM 复数推断。
func (ActionNode) TableName() string { return "action_nodes" }
