package model

import "time"

// SchemaVersion 记录显式执行的 GORM 迁移，不在业务启动时修改表结构。
type SchemaVersion struct {
	Version   uint64    `gorm:"primaryKey;autoIncrement:false"`
	AppliedAt time.Time `gorm:"not null"`
}

// SeedImport 标记一次完整导入，事务失败时不留下半份数据。
type SeedImport struct {
	ID        uint64    `gorm:"primaryKey;autoIncrement"`
	Dataset   string    `gorm:"type:varchar(64);not null;uniqueIndex"`
	SHA256    string    `gorm:"type:char(64) CHARACTER SET ascii COLLATE ascii_bin;not null"`
	CreatedAt time.Time `gorm:"not null"`
}

// LegacyAlias 将演示短 ID 显式映射为公开 UUID，只用于旧链接兼容。
type LegacyAlias struct {
	ID           uint64 `gorm:"primaryKey;autoIncrement"`
	Kind         string `gorm:"type:varchar(16) CHARACTER SET ascii COLLATE ascii_bin;not null;uniqueIndex:uq_alias,priority:1"`
	Alias        string `gorm:"type:varchar(100) CHARACTER SET ascii COLLATE ascii_bin;not null;uniqueIndex:uq_alias,priority:2"`
	ResourceUUID string `gorm:"type:char(36) CHARACTER SET ascii COLLATE ascii_bin;not null;index"`
	Dataset      string `gorm:"type:varchar(64);not null;index"`
}
