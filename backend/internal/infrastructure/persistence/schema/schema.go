// Package schema 通过有版本记录的 Go/GORM 迁移管理表结构。
package schema

import (
	"context"
	"fmt"
	"time"

	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
	"gorm.io/gorm"
)

// Models 明确列出本版本所有持久化模型，不包含 ORM 关联。
func Models() []any {
	return []any{&model.User{}, &model.UserCredential{}, &model.MediaAsset{}, &model.Graph{}, &model.ActionNode{}, &model.DocumentVersion{}, &model.DocumentState{}, &model.ActionReference{}, &model.AIConversation{}, &model.AIMessage{}, &model.AIGeneration{}, &model.GenerationMessage{}, &model.GenerationSource{}, &model.UserFollow{}, &model.GraphFollow{}, &model.ProfileHighlight{}, &model.IdempotencyRecord{}, &model.ActionImage{}, &model.DocumentImage{}, &model.BiographyImage{}, &model.SeedImport{}, &model.LegacyAlias{}}
}

// Migrate 仅由管理命令调用，拒绝接管无迁移记录的旧业务表。
func Migrate(ctx context.Context, db *gorm.DB) error {
	return db.WithContext(ctx).Connection(func(conn *gorm.DB) error {
		conn = conn.Session(&gorm.Session{NewDB: true})
		// MySQL 的 DDL 隐式提交，使用同一连接上的管理锁串行执行迁移。
		name := "exec_graph:migrate:" + conn.Migrator().CurrentDatabase()
		if len(name) > 64 {
			name = name[:64]
		}
		var acquired int
		if err := conn.Raw("SELECT GET_LOCK(?, 5)", name).Scan(&acquired).Error; err != nil {
			return fmt.Errorf("获取迁移锁: %w", err)
		}
		if acquired != 1 {
			return fmt.Errorf("另一个迁移正在执行")
		}
		defer conn.Exec("SELECT RELEASE_LOCK(?)", name)
		if !conn.Migrator().HasTable(&model.SchemaVersion{}) {
			for _, table := range Models() {
				if conn.Migrator().HasTable(table) {
					return fmt.Errorf("目标库存在未受本迁移管理的业务表，请选择独立的新 schema")
				}
			}
			if err := conn.AutoMigrate(&model.SchemaVersion{}); err != nil {
				return fmt.Errorf("初始化迁移记录: %w", err)
			}
		}
		var applied uint64
		if err := conn.Model(&model.SchemaVersion{}).Select("COALESCE(MAX(version), 0)").Scan(&applied).Error; err != nil {
			return err
		}
		if applied > constants.LatestSchemaVersion {
			return fmt.Errorf("数据库版本高于当前应用，禁止降级")
		}
		if applied == constants.LatestSchemaVersion {
			return Check(ctx, conn)
		}
		// 仅首版迁移使用这些模型；下一版本新增独立 Go 迁移，不修改已执行版本。
		for _, table := range Models() {
			if err := conn.Session(&gorm.Session{NewDB: true}).Set("gorm:table_options", "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs").AutoMigrate(table); err != nil {
				return fmt.Errorf("执行 GORM 初始迁移 %T: %w", table, err)
			}
		}
		if err := conn.Create(&model.SchemaVersion{Version: 1, AppliedAt: time.Now().UTC()}).Error; err != nil {
			return fmt.Errorf("记录迁移版本: %w", err)
		}
		return Check(ctx, conn)
	})
}

// Check 验证 schema 版本和模型表；不会自动修复或修改结构。
func Check(ctx context.Context, db *gorm.DB) error {
	db = db.WithContext(ctx)
	if !db.Migrator().HasTable(&model.SchemaVersion{}) {
		return fmt.Errorf("数据库尚未迁移，请先运行 manage migrate")
	}
	var versions []model.SchemaVersion
	if err := db.Order("version").Find(&versions).Error; err != nil {
		return err
	}
	if len(versions) != int(constants.LatestSchemaVersion) || versions[len(versions)-1].Version != constants.LatestSchemaVersion {
		return fmt.Errorf("数据库版本与应用不一致")
	}
	for _, table := range Models() {
		if !db.Migrator().HasTable(table) {
			return fmt.Errorf("数据库缺少模型表，迁移不完整")
		}
	}
	var foreignKeys int64
	if err := db.Table("information_schema.table_constraints").Where("constraint_schema = ? AND constraint_type = ?", db.Migrator().CurrentDatabase(), "FOREIGN KEY").Count(&foreignKeys).Error; err != nil {
		return fmt.Errorf("检查数据库外键: %w", err)
	}
	if foreignKeys != 0 {
		return fmt.Errorf("目标库包含外键，不符合 UUID 逻辑关联规范")
	}
	return nil
}
