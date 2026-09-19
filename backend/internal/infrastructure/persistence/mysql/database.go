package mysql

import (
	"context"
	"fmt"

	bootstrapconfig "github.com/singaurora/exec-graph/backend/internal/bootstrap/config"
	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
	drivermysql "gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func Open(config bootstrapconfig.DatabaseConfig) (*gorm.DB, error) {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=%s&parseTime=True&loc=Local", config.User, config.Password, config.Host, config.Port, config.Name, config.Charset)
	db, err := gorm.Open(drivermysql.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		return nil, fmt.Errorf("open mysql with gorm: %w", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), sharedconstants.DatabasePingTimeout)
	defer cancel()
	if err := db.WithContext(ctx).Exec("SELECT 1").Error; err != nil {
		return nil, fmt.Errorf("ping mysql: %w", err)
	}
	return db, nil
}

// Close 仅在应用退出时关闭 GORM 管理的连接池。
func Close(db *gorm.DB) {
	if db == nil {
		return
	}
	sqlDB, err := db.DB()
	if err == nil {
		_ = sqlDB.Close()
	}
}
