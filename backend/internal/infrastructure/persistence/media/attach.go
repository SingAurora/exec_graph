package media

import (
	"sort"
	"time"

	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// BindAssets 在业务事务内把上传资源绑定到唯一 owner；不允许跨 owner 复用。
func BindAssets(db *gorm.DB, actorID, ownerType, ownerID string, assetIDs []string) error {
	ids := make([]string, 0, len(assetIDs))
	seen := map[string]bool{}
	for _, assetID := range assetIDs {
		if assetID == "" || seen[assetID] {
			continue
		}
		if !id.Valid(assetID) {
			return fault.New(fault.Invalid, "图片标识不合法")
		}
		seen[assetID] = true
		ids = append(ids, assetID)
	}
	sort.Strings(ids)
	now := time.Now().UTC()
	for _, assetID := range ids {
		var asset model.MediaAsset
		if err := db.Clauses(clause.Locking{Strength: "UPDATE"}).Where("uuid = ?", assetID).Take(&asset).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return fault.New(fault.Invalid, "图片不存在")
			}
			return err
		}
		if asset.OwnerUUID != actorID || asset.Status == "deleted" {
			return fault.New(fault.Invalid, "图片不可用")
		}
		if asset.Status != "ready" {
			return fault.New(fault.Invalid, "图片尚未上传完成")
		}
		if asset.AttachedUUID != nil && (*asset.AttachedUUID != ownerID || asset.AttachedType == nil || *asset.AttachedType != ownerType) {
			return fault.New(fault.Conflict, "图片已被其他内容使用")
		}
		if err := db.Model(&model.MediaAsset{}).Where("uuid = ?", assetID).Updates(model.MediaAsset{AttachedType: &ownerType, AttachedUUID: &ownerID, UpdatedAt: now}).Error; err != nil {
			return err
		}
	}
	return nil
}

// MarkAssetsDeleted 标记用户主动删除的资源，实际对象由清理任务异步删除。
func MarkAssetsDeleted(db *gorm.DB, actorID string, assetIDs []string) error {
	ids := make([]string, 0, len(assetIDs))
	seen := map[string]bool{}
	for _, assetID := range assetIDs {
		if assetID == "" || seen[assetID] {
			continue
		}
		if !id.Valid(assetID) {
			return fault.New(fault.Invalid, "图片标识不合法")
		}
		seen[assetID] = true
		ids = append(ids, assetID)
	}
	if len(ids) == 0 {
		return nil
	}
	now := time.Now().UTC()
	return db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&model.MediaAsset{}).Where("uuid IN ? AND owner_uuid = ? AND status <> 'deleted'", ids, actorID).Updates(model.MediaAsset{Status: "deleted", DeletedAt: &now, UpdatedAt: now}).Error; err != nil {
			return err
		}
		return tx.Model(&model.MediaRetention{}).Where("asset_uuid IN ?", ids).Updates(model.MediaRetention{RetainUntil: now, NextAttemptAt: now}).Error
	})
}
