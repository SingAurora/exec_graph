package model

import "time"

// MediaRetention 管理真实上传的保留期限和持久化清理认领；内嵌演示资产不创建此记录。
type MediaRetention struct {
	ID               uint64     `gorm:"column:id;type:bigint unsigned;primaryKey;autoIncrement;not null"`
	AssetUUID        string     `gorm:"column:asset_uuid;type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;uniqueIndex:uq_media_retention_asset"`
	RetainUntil      time.Time  `gorm:"column:retain_until;type:datetime(6);not null;index:ix_media_retention_expiry"`
	CleanupStartedAt *time.Time `gorm:"column:cleanup_started_at;type:datetime(6)"`
	NextAttemptAt    time.Time  `gorm:"column:next_attempt_at;type:datetime(6);not null;index:ix_media_retention_retry"`
	Attempts         uint32     `gorm:"column:attempts;type:int unsigned;not null;default:0"`
}

// TableName 固定真实上传生命周期表名。
func (MediaRetention) TableName() string { return "media_retention" }
