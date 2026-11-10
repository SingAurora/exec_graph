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
	return append(initialModels(), &model.MediaRetention{}, &model.NodeDocument{})
}

func initialModels() []any {
	return []any{&model.User{}, &model.UserCredential{}, &model.MediaAsset{}, &model.Graph{}, &model.ActionNode{}, &model.DocumentVersion{}, &model.DocumentState{}, &model.ActionReference{}, &model.AIConversation{}, &model.AIMessage{}, &model.AIGeneration{}, &model.GenerationMessage{}, &model.GenerationSource{}, &model.UserFollow{}, &model.GraphFollow{}, &model.ProfileHighlight{}, &model.IdempotencyRecord{}, &model.ActionImage{}, &model.DocumentImage{}, &model.BiographyImage{}, &model.SeedImport{}}
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
		if applied < 1 {
			for _, table := range initialModels() {
				if err := conn.Session(&gorm.Session{NewDB: true}).Set("gorm:table_options", "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs").AutoMigrate(table); err != nil {
					return fmt.Errorf("执行 GORM 初始迁移 %T: %w", table, err)
				}
			}
			if err := conn.Create(&model.SchemaVersion{Version: 1, AppliedAt: time.Now().UTC()}).Error; err != nil {
				return fmt.Errorf("记录迁移版本: %w", err)
			}
		}
		if applied < 2 {
			if err := conn.Session(&gorm.Session{NewDB: true}).Set("gorm:table_options", "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs").AutoMigrate(&model.MediaRetention{}); err != nil {
				return fmt.Errorf("添加上传资产保留记录: %w", err)
			}
			if err := conn.Create(&model.SchemaVersion{Version: 2, AppliedAt: time.Now().UTC()}).Error; err != nil {
				return fmt.Errorf("记录上传资产迁移版本: %w", err)
			}
		}
		if applied < 3 {
			if err := conn.Session(&gorm.Session{NewDB: true}).Set("gorm:table_options", "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs").AutoMigrate(&model.User{}); err != nil {
				return fmt.Errorf("添加用户所在地字段: %w", err)
			}
			if err := conn.Create(&model.SchemaVersion{Version: 3, AppliedAt: time.Now().UTC()}).Error; err != nil {
				return fmt.Errorf("记录所在地迁移版本: %w", err)
			}
		}
		if applied < 4 {
			if conn.Migrator().HasConstraint(&model.AIConversation{}, "ck_ai_conversations") {
				if err := conn.Migrator().DropConstraint(&model.AIConversation{}, "ck_ai_conversations"); err != nil {
					return fmt.Errorf("移除旧 AI 对话约束: %w", err)
				}
			}
			if conn.Migrator().HasIndex(&model.AIConversation{}, "uq_ai_conversations_node") {
				if err := conn.Migrator().DropIndex(&model.AIConversation{}, "uq_ai_conversations_node"); err != nil {
					return fmt.Errorf("调整 AI 对话节点索引: %w", err)
				}
			}
			if err := conn.Session(&gorm.Session{NewDB: true}).Set("gorm:table_options", "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs").AutoMigrate(&model.AIConversation{}); err != nil {
				return fmt.Errorf("添加独立 AI 对话类型: %w", err)
			}
			if conn.Migrator().HasConstraint(&model.AIGeneration{}, "ck_ai_generations") {
				if err := conn.Migrator().DropConstraint(&model.AIGeneration{}, "ck_ai_generations"); err != nil {
					return fmt.Errorf("移除旧 AI 生成约束: %w", err)
				}
			}
			if err := conn.Session(&gorm.Session{NewDB: true}).Set("gorm:table_options", "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs").AutoMigrate(&model.AIGeneration{}); err != nil {
				return fmt.Errorf("添加约定生成结果字段: %w", err)
			}
			if err := conn.Create(&model.SchemaVersion{Version: 4, AppliedAt: time.Now().UTC()}).Error; err != nil {
				return fmt.Errorf("记录约定生成迁移版本: %w", err)
			}
		}
		if applied < 5 {
			if err := conn.Session(&gorm.Session{NewDB: true}).Set("gorm:table_options", "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs").AutoMigrate(&model.NodeDocument{}); err != nil {
				return fmt.Errorf("添加节点文档状态: %w", err)
			}
			if err := conn.Create(&model.SchemaVersion{Version: 5, AppliedAt: time.Now().UTC()}).Error; err != nil {
				return fmt.Errorf("记录节点文档迁移版本: %w", err)
			}
		}
		if applied < 6 {
			// 旧库中的 DATETIME 由 UTC 墙钟写入；切换连接默认东八区前先平移已有值。
			// 全新库 applied=0，不需要平移，避免新写入的数据被重复加八小时。
			if applied > 0 {
				if err := shiftDatetimesToChina(conn); err != nil {
					return err
				}
			}
			if err := conn.Create(&model.SchemaVersion{Version: 6, AppliedAt: time.Now().UTC()}).Error; err != nil {
				return fmt.Errorf("记录东八区迁移版本: %w", err)
			}
		}
		if applied < 7 {
			if conn.Migrator().HasTable("legacy_aliases") {
				if err := conn.Exec("DROP TABLE IF EXISTS `legacy_aliases`").Error; err != nil {
					return fmt.Errorf("删除旧短 ID 别名表: %w", err)
				}
			}
			if err := conn.Create(&model.SchemaVersion{Version: 7, AppliedAt: time.Now().UTC()}).Error; err != nil {
				return fmt.Errorf("记录短 ID 清理迁移版本: %w", err)
			}
		}
		if applied < 8 {
			if err := conn.Session(&gorm.Session{NewDB: true}).Set("gorm:table_options", "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs").AutoMigrate(&model.User{}); err != nil {
				return fmt.Errorf("扩展昵称长度: %w", err)
			}
			if err := conn.Create(&model.SchemaVersion{Version: 8, AppliedAt: time.Now().UTC()}).Error; err != nil {
				return fmt.Errorf("记录昵称长度迁移版本: %w", err)
			}
		}
		if applied < 9 {
			if err := conn.Session(&gorm.Session{NewDB: true}).Set("gorm:table_options", "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs").AutoMigrate(&model.UserCredential{}); err != nil {
				return fmt.Errorf("收窄邮箱长度: %w", err)
			}
			if err := conn.Create(&model.SchemaVersion{Version: 9, AppliedAt: time.Now().UTC()}).Error; err != nil {
				return fmt.Errorf("记录邮箱长度迁移版本: %w", err)
			}
		}
		if applied < 11 {
			if err := conn.Session(&gorm.Session{NewDB: true}).Set("gorm:table_options", "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs").AutoMigrate(&model.MediaAsset{}); err != nil {
				return fmt.Errorf("增加图片 owner: %w", err)
			}
			if err := conn.Create(&model.SchemaVersion{Version: 11, AppliedAt: time.Now().UTC()}).Error; err != nil {
				return fmt.Errorf("记录图片 owner 迁移版本: %w", err)
			}
		}
		if applied < 10 {
			if conn.Migrator().HasColumn(&model.UserCredential{}, "password_hash") {
				if conn.Migrator().HasConstraint(&model.UserCredential{}, "ck_user_credentials") {
					if err := conn.Migrator().DropConstraint(&model.UserCredential{}, "ck_user_credentials"); err != nil {
						return fmt.Errorf("移除旧密码检查约束: %w", err)
					}
				}
				// 旧值是 Argon2id，无法还原明文；demo 阶段统一覆盖为已知密码。
				if err := conn.Exec("UPDATE `user_credentials` SET `password_hash` = ?", constants.DemoPassword).Error; err != nil {
					return fmt.Errorf("重置 demo 密码: %w", err)
				}
				if err := conn.Migrator().RenameColumn(&model.UserCredential{}, "password_hash", "password"); err != nil {
					return fmt.Errorf("重命名密码列: %w", err)
				}
			}
			if err := conn.Session(&gorm.Session{NewDB: true}).Set("gorm:table_options", "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs").AutoMigrate(&model.UserCredential{}); err != nil {
				return fmt.Errorf("切换 demo 密码列: %w", err)
			}
			if !conn.Migrator().HasConstraint(&model.UserCredential{}, "ck_user_credentials") {
				if err := conn.Exec("ALTER TABLE `user_credentials` ADD CONSTRAINT `ck_user_credentials` CHECK (CHAR_LENGTH(`password`) > 0 AND `auth_version` > 0)").Error; err != nil {
					return fmt.Errorf("添加 demo 密码检查约束: %w", err)
				}
			}
			if err := conn.Create(&model.SchemaVersion{Version: 10, AppliedAt: time.Now().UTC()}).Error; err != nil {
				return fmt.Errorf("记录 demo 明文密码迁移版本: %w", err)
			}
		}
		return Check(ctx, conn)
	})
}

// shiftDatetimesToChina 把既有 DATETIME 墙钟从 UTC 平移到东八区。
func shiftDatetimesToChina(db *gorm.DB) error {
	type column struct {
		TableName  string `gorm:"column:TABLE_NAME"`
		ColumnName string `gorm:"column:COLUMN_NAME"`
	}
	var columns []column
	if err := db.Raw("SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.columns WHERE table_schema = DATABASE() AND data_type = 'datetime'").Scan(&columns).Error; err != nil {
		return fmt.Errorf("读取待平移时间列: %w", err)
	}
	for _, item := range columns {
		statement := fmt.Sprintf("UPDATE `%s` SET `%s` = DATE_ADD(`%s`, INTERVAL 8 HOUR) WHERE `%s` IS NOT NULL", item.TableName, item.ColumnName, item.ColumnName, item.ColumnName)
		if err := db.Exec(statement).Error; err != nil {
			return fmt.Errorf("平移时间列 %s.%s: %w", item.TableName, item.ColumnName, err)
		}
	}
	return nil
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
