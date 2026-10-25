// Package database 实现 GORM/MySQL 连接及隔离数据库的显式创建。
package database

import (
	"context"
	"fmt"
	"net"
	"strconv"
	"time"

	driver "github.com/go-sql-driver/mysql"
	"github.com/singaurora/exec-graph/backend/internal/bootstrap/config"
	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Open 创建 UTC 连接池，关闭自动外键，禁止把 SQL 参数写入日志。
func Open(c config.Database) (*gorm.DB, error) {
	dsn := driver.NewConfig()
	dsn.User = c.User
	dsn.Passwd = c.Password
	dsn.Net = "tcp"
	dsn.Addr = net.JoinHostPort(c.Host, strconv.Itoa(c.Port))
	dsn.DBName = c.Schema
	dsn.ParseTime = true
	dsn.Loc = time.UTC
	dsn.Timeout = constants.DependencyTimeout
	dsn.ReadTimeout = constants.DependencyTimeout
	dsn.WriteTimeout = constants.DependencyTimeout
	dsn.Params = map[string]string{"charset": "utf8mb4", "time_zone": "'+00:00'"}
	db, err := gorm.Open(mysql.Open(dsn.FormatDSN()), &gorm.Config{DisableForeignKeyConstraintWhenMigrating: true, Logger: logger.Default.LogMode(logger.Silent), TranslateError: true})
	if err != nil {
		return nil, fmt.Errorf("连接 MySQL 失败: %w", err)
	}
	pool, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("获取 MySQL 连接池: %w", err)
	}
	pool.SetMaxOpenConns(20)
	pool.SetMaxIdleConns(5)
	pool.SetConnMaxLifetime(5 * time.Minute)
	ctx, cancel := context.WithTimeout(context.Background(), constants.DependencyTimeout)
	defer cancel()
	if err := pool.PingContext(ctx); err != nil {
		_ = pool.Close()
		return nil, fmt.Errorf("探测 MySQL: %w", err)
	}
	return db, nil
}

// CreateSchema 是显式数据库管理操作；CREATE DATABASE 无对应 GORM Migrator API。
func CreateSchema(c config.Database) error {
	if !config.ValidSchema(c.Schema) {
		return fmt.Errorf("数据库名称不合法")
	}
	schema := c.Schema
	c.Schema = ""
	db, err := Open(c)
	if err != nil {
		return err
	}
	defer Close(db)
	return db.Exec("CREATE DATABASE IF NOT EXISTS `" + schema + "` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs").Error
}

// Close 关闭应用拥有的连接池。
func Close(db *gorm.DB) {
	if pool, err := db.DB(); err == nil {
		_ = pool.Close()
	}
}
