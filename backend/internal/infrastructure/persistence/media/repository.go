// Package media 保存真实上传生命周期，通过资产行锁协调保存、续期和回收。
package media

import (
	"context"
	"errors"
	"sort"
	"time"

	"github.com/singaurora/exec-graph/backend/internal/application/identity"
	app "github.com/singaurora/exec-graph/backend/internal/application/media"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/transaction"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Repository 由组合根注入数据库连接。
type Repository struct{ db *gorm.DB }

// New 创建资产生命周期仓储。
func New(db *gorm.DB) *Repository { return &Repository{db} }

// Reserve 在云端上传之前登记全部元信息，失败及超时上传也有可追踪对象键。
func (r *Repository) Reserve(ctx context.Context, actor identity.Actor, upload app.Upload, limits app.Limits) error {
	return transaction.Within(ctx, r.db, actor, func(tx *transaction.Scope) error {
		now := time.Now().UTC()
		usage, err := usage(tx.DB, actor.UserID, now)
		if err != nil {
			return err
		}
		if err := limits.Check(usage, upload.ByteSize); err != nil {
			return err
		}
		asset := model.MediaAsset{UUID: upload.AssetID, OwnerUUID: actor.UserID, ObjectKey: upload.ObjectKey, Status: "pending", MIMEType: &upload.MIMEType, ByteSize: &upload.ByteSize, Width: &upload.Width, Height: &upload.Height, SHA256: upload.SHA256, CreatedAt: now, UpdatedAt: now}
		if err := tx.DB.Create(&asset).Error; err != nil {
			return err
		}
		return tx.DB.Create(&model.MediaRetention{AssetUUID: upload.AssetID, RetainUntil: upload.RetainUntil, NextAttemptAt: upload.RetainUntil}).Error
	})
}

// Complete 云端成功之后才开放图片引用。
func (r *Repository) Complete(ctx context.Context, actor identity.Actor, uuid string) error {
	return transaction.Within(ctx, r.db, actor, func(tx *transaction.Scope) error {
		var asset model.MediaAsset
		if err := tx.DB.Clauses(clause.Locking{Strength: "UPDATE"}).Where("uuid = ? AND owner_uuid = ? AND status = ?", uuid, actor.UserID, "pending").Take(&asset).Error; err != nil {
			return err
		}
		var retention model.MediaRetention
		if err := tx.DB.Where("asset_uuid = ?", uuid).Take(&retention).Error; err != nil {
			return err
		}
		if retention.CleanupStartedAt != nil {
			return fault.New(fault.Conflict, "图片已过期，请重新上传")
		}
		return tx.DB.Model(&asset).Updates(model.MediaAsset{Status: "ready", UpdatedAt: time.Now().UTC()}).Error
	})
}

// Retain 对账号拥有且未进入回收的资源续期；批量操作全部成功或全部回滚。
func (r *Repository) Retain(ctx context.Context, actor identity.Actor, ids []string, until time.Time) error {
	return transaction.Within(ctx, r.db, actor, func(tx *transaction.Scope) error {
		ordered := append([]string{}, ids...)
		sort.Strings(ordered)
		for _, uuid := range ordered {
			if err := tx.CheckAssets(&uuid); err != nil {
				return err
			}
			if err := tx.DB.Model(&model.MediaRetention{}).Where("asset_uuid = ? AND retain_until < ?", uuid, until).Update("retain_until", until).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

// File 返回可读状态以及由真实业务引用推导的公开权限。
func (r *Repository) File(ctx context.Context, uuid string) (app.File, error) {
	db := r.db.WithContext(ctx)
	var asset model.MediaAsset
	err := db.Where("uuid = ? AND status = ? AND deleted_at IS NULL", uuid, "ready").Take(&asset).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return app.File{}, fault.New(fault.NotFound, "图片不存在")
	}
	if err != nil {
		return app.File{}, err
	}
	var claimed int64
	if err := db.Model(&model.MediaRetention{}).Where("asset_uuid = ? AND cleanup_started_at IS NOT NULL", uuid).Count(&claimed).Error; err != nil {
		return app.File{}, err
	}
	if claimed != 0 {
		return app.File{}, fault.New(fault.NotFound, "图片不存在")
	}
	public, err := references(db, uuid, true)
	if err != nil {
		return app.File{}, err
	}
	if asset.MIMEType == nil {
		return app.File{}, fault.New(fault.Unavailable, "图片元信息不完整")
	}
	return app.File{ObjectKey: asset.ObjectKey, MIMEType: *asset.MIMEType, OwnerID: asset.OwnerUUID, Public: public}, nil
}
