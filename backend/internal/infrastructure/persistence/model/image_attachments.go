// Package model 定义持久化模型。所有关联均为 UUID 标量，不声明 ORM 关联或数据库外键。
package model

// ActionImage 对应 action_images，业务规则由 application 用例校验。
type ActionImage struct {
	ID          uint64  `gorm:"column:id;type:bigint unsigned;primaryKey;autoIncrement;not null;check:ck_action_images,(position > 0) AND ((asset_uuid IS NOT NULL AND external_url IS NULL) OR (asset_uuid IS NULL AND external_url IS NOT NULL AND CHAR_LENGTH(external_url) > 0))"`
	NodeUUID    string  `gorm:"column:node_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;uniqueIndex:uq_action_images_position,priority:1"`
	AssetUUID   *string `gorm:"column:asset_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;index:ix_action_images_asset,priority:1"`
	ExternalURL *string `gorm:"column:external_url;type:text;comment:外链图片保留来源，不冒充站内上传资产"`
	Position    uint16  `gorm:"column:position;type:smallint unsigned;not null;uniqueIndex:uq_action_images_position,priority:2"`
	AltText     string  `gorm:"column:alt_text;type:varchar(500);not null"`
}

// TableName 固定表名，避免依赖 ORM 复数推断。
func (ActionImage) TableName() string { return "action_images" }

// DocumentImage 对应 document_images，业务规则由 application 用例校验。
type DocumentImage struct {
	ID                  uint64 `gorm:"column:id;type:bigint unsigned;primaryKey;autoIncrement;not null;check:ck_document_images,(position > 0)"`
	DocumentVersionUUID string `gorm:"column:document_version_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;uniqueIndex:uq_document_images_position,priority:1"`
	AssetUUID           string `gorm:"column:asset_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;index:ix_document_images_asset,priority:1"`
	Position            uint16 `gorm:"column:position;type:smallint unsigned;not null;uniqueIndex:uq_document_images_position,priority:2"`
	AltText             string `gorm:"column:alt_text;type:varchar(500);not null"`
}

// TableName 固定表名，避免依赖 ORM 复数推断。
func (DocumentImage) TableName() string { return "document_images" }

// BiographyImage 对应 profile_biography_images，业务规则由 application 用例校验。
type BiographyImage struct {
	ID        uint64 `gorm:"column:id;type:bigint unsigned;primaryKey;autoIncrement;not null;check:ck_profile_biography_images,(position > 0)"`
	UserUUID  string `gorm:"column:user_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;uniqueIndex:uq_profile_images_position,priority:1"`
	AssetUUID string `gorm:"column:asset_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;index:ix_profile_images_asset,priority:1"`
	Position  uint16 `gorm:"column:position;type:smallint unsigned;not null;uniqueIndex:uq_profile_images_position,priority:2"`
	AltText   string `gorm:"column:alt_text;type:varchar(500);not null"`
}

// TableName 固定表名，避免依赖 ORM 复数推断。
func (BiographyImage) TableName() string { return "profile_biography_images" }
