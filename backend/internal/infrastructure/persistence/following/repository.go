// Package following 实现关注集合的 GORM 仓储。
package following

import (
	"context"
	"errors"

	"github.com/singaurora/exec-graph/backend/internal/application/catalogue"
	app "github.com/singaurora/exec-graph/backend/internal/application/following"
	"github.com/singaurora/exec-graph/backend/internal/application/identity"
	read "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/catalogue"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/transaction"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Repository 持有外部注入的连接。
type Repository struct{ db *gorm.DB }

// New 创建关注仓储。
func New(db *gorm.DB) *Repository { return &Repository{db: db} }

type followingTransaction struct{ *transaction.Scope }

// Within 在账号串行事务中处理显式关注。
func (r *Repository) Within(ctx context.Context, actor identity.Actor, run func(app.Transaction) error) error {
	return transaction.Within(ctx, r.db, actor, func(scope *transaction.Scope) error { return run(&followingTransaction{scope}) })
}

func (t *followingTransaction) Available(kind, uuid string) (bool, error) {
	var count int64
	if kind == "user" {
		err := t.DB.Model(&model.User{}).Where("uuid = ? AND disabled_at IS NULL", uuid).Count(&count).Error
		return count == 1, err
	}
	if _, err := t.LockGraph(uuid); err != nil {
		var known *fault.Error
		if errors.As(err, &known) && known.Code == fault.NotFound {
			return false, nil
		}
		return false, err
	}
	err := t.DB.Model(&model.ActionNode{}).Where("graph_uuid = ?", uuid).Limit(1).Count(&count).Error
	return count > 0, err
}

func (t *followingTransaction) Set(input app.SetFollowingInput) error {
	if input.Kind == "user" {
		row := model.UserFollow{FollowerUUID: t.Actor.UserID, FollowedUserUUID: input.TargetID}
		if *input.Following {
			return t.DB.Clauses(clause.OnConflict{DoNothing: true}).Create(&row).Error
		}
		return t.DB.Where("follower_uuid = ? AND followed_user_uuid = ?", t.Actor.UserID, input.TargetID).Delete(&row).Error
	}
	row := model.GraphFollow{UserUUID: t.Actor.UserID, GraphUUID: input.TargetID}
	if *input.Following {
		return t.DB.Clauses(clause.OnConflict{DoNothing: true}).Create(&row).Error
	}
	return t.DB.Where("user_uuid = ? AND graph_uuid = ?", t.Actor.UserID, input.TargetID).Delete(&row).Error
}

func (t *followingTransaction) View() (catalogue.FollowingView, error) {
	return read.New(t.DB).Following(t.DB.Statement.Context, t.Actor.UserID)
}
