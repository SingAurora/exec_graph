// Package graph 实现图用例的 GORM 事务仓储。
package graph

import (
	"context"
	"time"

	"github.com/singaurora/exec-graph/backend/internal/application/catalogue"
	app "github.com/singaurora/exec-graph/backend/internal/application/graph"
	"github.com/singaurora/exec-graph/backend/internal/application/identity"
	read "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/catalogue"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/transaction"
	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
	"gorm.io/gorm"
)

// Repository 只持有组合根注入的数据库。
type Repository struct{ db *gorm.DB }

// New 创建图仓储。
func New(db *gorm.DB) *Repository { return &Repository{db: db} }

type graphTransaction struct{ *transaction.Scope }

// Within 向 application 提供同一事务内的图读写能力。
func (r *Repository) Within(ctx context.Context, actor identity.Actor, run func(app.Transaction) error) error {
	return transaction.Within(ctx, r.db, actor, func(scope *transaction.Scope) error { return run(&graphTransaction{scope}) })
}

func (t *graphTransaction) Lock(uuid string) (app.Snapshot, error) {
	row, err := t.LockGraph(uuid)
	if err != nil {
		return app.Snapshot{}, err
	}
	view, err := t.View(uuid)
	if err != nil {
		return app.Snapshot{}, err
	}
	var count int64
	if err := t.DB.Model(&model.ActionNode{}).Where("graph_uuid = ?", uuid).Count(&count).Error; err != nil {
		return app.Snapshot{}, err
	}
	var contributors []string
	// 同数量按首次行动时间和 UUID 排序，避免编辑资格随查询计划漂移。
	err = t.DB.Model(&model.ActionNode{}).Where("graph_uuid = ?", uuid).Group("author_uuid").Order("COUNT(*) DESC, MIN(created_at) ASC, author_uuid ASC").Limit(constants.GraphEditorContributorLimit).Pluck("author_uuid", &contributors).Error
	return app.Snapshot{View: view, NodeCount: uint32(count), TopContributorIDs: contributors, AvatarAssetID: row.AvatarAssetUUID, BackgroundAssetID: row.CoverAssetUUID}, err
}

func (t *graphTransaction) Create(view catalogue.GraphView) error {
	return t.DB.Create(&model.Graph{UUID: view.ID, OwnerUUID: view.OwnerID, Title: view.Title, Description: view.Description, NextNodeNumber: 1, Version: 1, CreatedAt: view.CreatedAt, UpdatedAt: view.UpdatedAt}).Error
}

func (t *graphTransaction) Update(input app.UpdateGraphInput) error {
	columns := []string{"Title", "Description", "AvatarAssetUUID", "CoverAssetUUID", "Version", "UpdatedAt"}
	row := model.Graph{Title: input.Title, Description: input.Description, AvatarAssetUUID: input.AvatarAssetID, CoverAssetUUID: input.BackgroundAssetID, Version: input.ExpectedVersion + 1, UpdatedAt: time.Now().UTC()}
	if input.ContextGuide != nil {
		columns = append(columns, "ContextGuide")
		row.ContextGuide = *input.ContextGuide
	}
	return t.DB.Model(&model.Graph{}).Where("uuid = ?", input.GraphID).Select(columns).Updates(row).Error
}

func (t *graphTransaction) Delete(uuid string) error {
	now := time.Now().UTC()
	if err := t.DB.Model(&model.Graph{}).Where("uuid = ?", uuid).Updates(model.Graph{DeletedAt: &now, UpdatedAt: now}).Error; err != nil {
		return err
	}
	if err := t.DB.Where("graph_uuid = ?", uuid).Delete(&model.GraphFollow{}).Error; err != nil {
		return err
	}
	return t.DB.Where("node_uuid IN (?)", t.DB.Model(&model.ActionNode{}).Select("uuid").Where("graph_uuid = ?", uuid)).Delete(&model.ProfileHighlight{}).Error
}

func (t *graphTransaction) View(uuid string) (catalogue.GraphView, error) {
	return read.New(t.DB).Graph(t.DB.Statement.Context, uuid)
}
