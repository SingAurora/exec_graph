// Package draft 实现云端草稿的 GORM 持久化。
package draft

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	app "github.com/singaurora/exec-graph/backend/internal/application/draft"
	"github.com/singaurora/exec-graph/backend/internal/application/identity"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/media"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
	"github.com/singaurora/exec-graph/backend/internal/shared/timezone"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Repository 持有数据库连接。
type Repository struct{ db *gorm.DB }

// New 创建草稿仓储。
func New(db *gorm.DB) *Repository { return &Repository{db: db} }

func toView(row model.WorkspaceDraft) *app.DraftView {
	return &app.DraftView{UUID: row.UUID, Version: row.Version, Payload: json.RawMessage(row.Payload), LastAccessedAt: timezone.InChina(row.LastAccessedAt)}
}

// Get 读取草稿并续期。
func (r *Repository) Get(ctx context.Context, actor identity.Actor, scope app.Scope) (*app.DraftView, error) {
	var row model.WorkspaceDraft
	err := r.db.WithContext(ctx).Where("owner_uuid = ? AND scope_key = ?", actor.UserID, app.ScopeKey(scope)).Take(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) { return nil, nil }
	if err != nil { return nil, err }
	now := time.Now().UTC()
	if err := r.db.WithContext(ctx).Model(&model.WorkspaceDraft{}).Where("uuid = ?", row.UUID).Updates(model.WorkspaceDraft{LastAccessedAt: now, UpdatedAt: now}).Error; err != nil { return nil, err }
	row.LastAccessedAt = now
	return toView(row), nil
}

// Save 新建或按版本更新草稿，并在同一事务绑定图片。
func (r *Repository) Save(ctx context.Context, actor identity.Actor, scope app.Scope, payload json.RawMessage, assetIDs []string, expected uint32) (app.DraftView, error) {
	var out app.DraftView
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var row model.WorkspaceDraft
		key := app.ScopeKey(scope)
		err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("owner_uuid = ? AND scope_key = ?", actor.UserID, key).Take(&row).Error
		now := time.Now().UTC()
		if errors.Is(err, gorm.ErrRecordNotFound) {
			if expected != 0 { return fault.New(fault.Conflict, "草稿已被删除或尚未创建") }
			row = model.WorkspaceDraft{UUID: id.New(), OwnerUUID: actor.UserID, ScopeKey: key, WorkspaceType: scope.Type, GraphUUID: scope.GraphUUID, NodeUUID: scope.NodeUUID, ParentUUID: scope.ParentUUID, Payload: payload, Version: 1, LastAccessedAt: now, CreatedAt: now, UpdatedAt: now}
			if err := tx.Create(&row).Error; err != nil { return err }
		} else if err != nil {
			return err
		} else {
			if row.Version != expected { return fault.New(fault.Conflict, "草稿已在其他页面更新") }
			if err := tx.Model(&row).Updates(model.WorkspaceDraft{Payload: payload, Version: row.Version + 1, LastAccessedAt: now, UpdatedAt: now}).Error; err != nil { return err }
			row.Version++
			row.Payload = payload
			row.LastAccessedAt = now
		}
		if err := media.BindAssets(tx, actor.UserID, "draft", row.UUID, assetIDs); err != nil { return err }
		out = *toView(row)
		return nil
	})
	return out, err
}

// Delete 删除草稿并标记图片待回收。
func (r *Repository) Delete(ctx context.Context, actor identity.Actor, scope app.Scope) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var row model.WorkspaceDraft
		err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("owner_uuid = ? AND scope_key = ?", actor.UserID, app.ScopeKey(scope)).Take(&row).Error
		if errors.Is(err, gorm.ErrRecordNotFound) { return nil }
		if err != nil { return err }
		if err := media.MarkDraftAssetsDeleted(tx, actor.UserID, row.UUID); err != nil { return err }
		return tx.Where("uuid = ?", row.UUID).Delete(&model.WorkspaceDraft{}).Error
	})
}
