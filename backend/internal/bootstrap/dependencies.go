// Package bootstrap 是唯一的组合根，拥有配置、外部客户端与服务装配。
package bootstrap

import (
	"context"
	appaccount "github.com/singaurora/exec-graph/backend/internal/application/account"
	appgeneration "github.com/singaurora/exec-graph/backend/internal/application/generation"
	appmedia "github.com/singaurora/exec-graph/backend/internal/application/media"
	"github.com/singaurora/exec-graph/backend/internal/bootstrap/config"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/ai"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/mail"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/database"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/session"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/storage"
	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
	"gorm.io/gorm"
)

// Dependencies 集中持有当前启动模式需要的资源。
type Dependencies struct {
	Config   config.Config
	DB       *gorm.DB
	Sessions *session.Store
	Objects  appmedia.Objects
	AI       appgeneration.Provider
	Mail     appaccount.Sender
}

// Open 加载旧配置并创建 MySQL、Redis 连接。
func Open(ctx context.Context, needRedis bool) (*Dependencies, error) {
	c, err := config.Load(config.Path())
	if err != nil {
		return nil, err
	}
	db, err := database.Open(c.Database)
	if err != nil {
		return nil, err
	}
	deps := &Dependencies{Config: c, DB: db}
	deps.Objects, err = storage.New(c.Storage, c.Credentials)
	if err != nil {
		deps.Close()
		return nil, err
	}
	deps.AI, err = ai.New(c.AI)
	if err != nil {
		deps.Close()
		return nil, err
	}
	deps.Mail, err = mail.New(c.Mail, c.Credentials)
	if err != nil {
		deps.Close()
		return nil, err
	}
	if needRedis {
		probe, cancel := context.WithTimeout(ctx, constants.DependencyTimeout)
		defer cancel()
		deps.Sessions, err = session.Open(probe, c.Redis)
		if err != nil {
			deps.Close()
			return nil, err
		}
	}
	return deps, nil
}

// Close 关闭此组合根拥有的外部连接。
func (d *Dependencies) Close() {
	if d.Sessions != nil {
		_ = d.Sessions.Close()
	}
	database.Close(d.DB)
}

// PrepareDatabase 只为显式管理命令创建目标数据库。
func PrepareDatabase() error {
	c, err := config.Load(config.Path())
	if err != nil {
		return err
	}
	return database.CreateSchema(c.Database)
}
