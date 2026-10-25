// Package model 定义持久化模型。所有关联均为 UUID 标量，不声明 ORM 关联或数据库外键。
package model

import "time"

// User 对应 users，业务规则由 application 用例校验。
type User struct {
	ID                uint64     `gorm:"column:id;type:bigint unsigned;primaryKey;autoIncrement;not null;index:ix_users_name,priority:2;check:ck_users,(gender IN ('unknown', 'male', 'female')) AND (version > 0) AND (CHAR_LENGTH(TRIM(name)) > 0);comment:内部主键，不对外返回"`
	UUID              string     `gorm:"column:uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;uniqueIndex:uq_users_uuid,priority:1;comment:服务端分配的公开 UUID"`
	AvatarAssetUUID   *string    `gorm:"column:avatar_asset_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;index:ix_users_avatar,priority:1;comment:关联 media_assets.uuid；NULL 使用文字头像"`
	CoverAssetUUID    *string    `gorm:"column:cover_asset_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;index:ix_users_cover,priority:1;comment:关联 media_assets.uuid；NULL 使用默认背景"`
	Name              string     `gorm:"column:name;type:varchar(30);not null;index:ix_users_name,priority:1;comment:公开昵称，不要求唯一"`
	Gender            string     `gorm:"column:gender;type:varchar(8) CHARACTER SET ascii COLLATE ascii_bin;not null;default:'unknown'"`
	BiographyMarkdown string     `gorm:"column:biography_markdown;type:text;not null;comment:个人简介 Markdown，接口仍映射为 bio"`
	Version           uint32     `gorm:"column:version;type:int unsigned;not null;default:1;comment:资料及精选共用的并发版本"`
	DisabledAt        *time.Time `gorm:"column:disabled_at;type:datetime(6);comment:停用后拒绝建立会话和业务写入"`
	CreatedAt         time.Time  `gorm:"column:created_at;type:datetime(6);not null;default:CURRENT_TIMESTAMP(6)"`
	UpdatedAt         time.Time  `gorm:"column:updated_at;type:datetime(6);not null;default:CURRENT_TIMESTAMP(6)"`
	IsTestAccount     bool       `gorm:"column:is_test_account;not null;default:false;index:ix_users_test"`
	TestDataset       *string    `gorm:"column:test_dataset;type:varchar(64);index:ix_users_dataset"`
}

// TableName 固定表名，避免依赖 ORM 复数推断。
func (User) TableName() string { return "users" }

// UserCredential 对应 user_credentials，业务规则由 application 用例校验。
type UserCredential struct {
	ID                uint64    `gorm:"column:id;type:bigint unsigned;primaryKey;autoIncrement;not null;check:ck_user_credentials,(CHAR_LENGTH(password_hash) > 0) AND (auth_version > 0)"`
	UserUUID          string    `gorm:"column:user_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;uniqueIndex:uq_user_credentials_user,priority:1"`
	Email             string    `gorm:"column:email;type:varchar(254) CHARACTER SET ascii COLLATE ascii_bin;not null;uniqueIndex:uq_user_credentials_email,priority:1;comment:首版邮箱按去首尾空白、转小写规范化"`
	PasswordHash      string    `gorm:"column:password_hash;type:varchar(255) CHARACTER SET ascii COLLATE ascii_bin;not null;comment:Argon2id 编码串，含参数和随机盐；绝不存明文"`
	EmailVerifiedAt   time.Time `gorm:"column:email_verified_at;type:datetime(6);not null;comment:完成邮箱验证后才创建账户"`
	AuthVersion       uint32    `gorm:"column:auth_version;type:int unsigned;not null;default:1;comment:密码重置等操作递增，Redis 会话携带该版本"`
	PasswordChangedAt time.Time `gorm:"column:password_changed_at;type:datetime(6);not null"`
	CreatedAt         time.Time `gorm:"column:created_at;type:datetime(6);not null;default:CURRENT_TIMESTAMP(6)"`
	UpdatedAt         time.Time `gorm:"column:updated_at;type:datetime(6);not null;default:CURRENT_TIMESTAMP(6)"`
}

// TableName 固定表名，避免依赖 ORM 复数推断。
func (UserCredential) TableName() string { return "user_credentials" }

// MediaAsset 对应 media_assets，业务规则由 application 用例校验。
type MediaAsset struct {
	ID        uint64     `gorm:"column:id;type:bigint unsigned;primaryKey;autoIncrement;not null;index:ix_media_assets_owner,priority:3;index:ix_media_assets_cleanup,priority:3;check:ck_media_assets,(status IN ('pending', 'ready', 'failed', 'deleted')) AND (mime_type IS NULL OR mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'image/gif')) AND ((width IS NULL OR width > 0) AND (height IS NULL OR height > 0)) AND (status <> 'ready' OR (mime_type IS NOT NULL AND byte_size IS NOT NULL AND byte_size > 0 AND width IS NOT NULL AND height IS NOT NULL AND sha256 IS NOT NULL)) AND ((status = 'deleted' AND deleted_at IS NOT NULL) OR (status <> 'deleted' AND deleted_at IS NULL))"`
	UUID      string     `gorm:"column:uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;uniqueIndex:uq_media_assets_uuid,priority:1"`
	OwnerUUID string     `gorm:"column:owner_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;index:ix_media_assets_owner,priority:1"`
	ObjectKey string     `gorm:"column:object_key;type:varchar(512) CHARACTER SET ascii COLLATE ascii_bin;not null;uniqueIndex:uq_media_assets_object_key,priority:1;comment:对象存储键，不保存带签名的临时 URL"`
	Status    string     `gorm:"column:status;type:varchar(12) CHARACTER SET ascii COLLATE ascii_bin;not null;default:'pending';index:ix_media_assets_cleanup,priority:1"`
	MIMEType  *string    `gorm:"column:mime_type;type:varchar(32) CHARACTER SET ascii COLLATE ascii_bin;comment:后端识别的实际类型，不信任文件扩展名"`
	ByteSize  *uint64    `gorm:"column:byte_size;type:bigint unsigned"`
	Width     *uint32    `gorm:"column:width;type:int unsigned"`
	Height    *uint32    `gorm:"column:height;type:int unsigned"`
	SHA256    []byte     `gorm:"column:sha256;type:binary(32);comment:校验文件内容，不做跨账户去重授权"`
	CreatedAt time.Time  `gorm:"column:created_at;type:datetime(6);not null;default:CURRENT_TIMESTAMP(6);index:ix_media_assets_owner,priority:2;index:ix_media_assets_cleanup,priority:2"`
	UpdatedAt time.Time  `gorm:"column:updated_at;type:datetime(6);not null;default:CURRENT_TIMESTAMP(6)"`
	DeletedAt *time.Time `gorm:"column:deleted_at;type:datetime(6)"`
}

// TableName 固定表名，避免依赖 ORM 复数推断。
func (MediaAsset) TableName() string { return "media_assets" }
