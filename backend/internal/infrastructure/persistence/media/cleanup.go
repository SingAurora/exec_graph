package media

import (
	"context"
	"database/sql"
	"errors"
	"time"

	app "github.com/singaurora/exec-graph/backend/internal/application/media"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Candidates 只扫描登记过生命周期的真实上传，不枚举或删除存储桶内的其他文件。
func (r *Repository) Candidates(ctx context.Context, now time.Time) ([]string, error) {
	var ids []string
	err := r.db.WithContext(ctx).Table("media_retention AS r").Joins("JOIN media_assets a ON a.uuid = r.asset_uuid AND a.deleted_at IS NULL").Where("(r.cleanup_started_at IS NULL AND r.retain_until <= ?) OR (r.cleanup_started_at IS NOT NULL AND r.next_attempt_at <= ?)", now, now).Order("r.next_attempt_at, r.id").Limit(constants.MediaCleanupBatch).Pluck("r.asset_uuid", &ids).Error
	return ids, err
}

// Claim 与业务保存锁同一资产行，认领提交后永久禁止新增引用及草稿续期。
func (r *Repository) Claim(ctx context.Context, uuid string, now time.Time) (*app.CleanupTarget, error) {
	var out *app.CleanupTarget
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var asset model.MediaAsset
		err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("uuid = ? AND deleted_at IS NULL", uuid).Take(&asset).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		if err != nil {
			return err
		}
		var retention model.MediaRetention
		if err := tx.Where("asset_uuid = ?", uuid).Take(&retention).Error; err != nil {
			return err
		}
		if retention.CleanupStartedAt == nil {
			if retention.RetainUntil.After(now) {
				return nil
			}
			used, err := references(tx, uuid, false)
			if err != nil {
				return err
			}
			if used {
				// 推迟重查，避免大批长期引用图片饿死后面的过期候选。
				return tx.Model(&retention).Updates(model.MediaRetention{RetainUntil: now.Add(constants.UnusedMediaRetention), NextAttemptAt: now.Add(constants.UnusedMediaRetention)}).Error
			}
			retention.CleanupStartedAt = &now
		} else if retention.NextAttemptAt.After(now) {
			return nil
		}
		retention.Attempts++
		retention.NextAttemptAt = now.Add(constants.MediaRetryDelay)
		if err := tx.Save(&retention).Error; err != nil {
			return err
		}
		out = &app.CleanupTarget{AssetID: uuid, ObjectKey: asset.ObjectKey}
		return nil
	}, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	return out, err
}

// FinishDelete 只在云端删除成功后标记逻辑删除，保留对象键和重试审计记录。
func (r *Repository) FinishDelete(ctx context.Context, uuid string, now time.Time) error {
	return r.db.WithContext(ctx).Model(&model.MediaAsset{}).Where("uuid = ? AND deleted_at IS NULL", uuid).Updates(model.MediaAsset{Status: "deleted", DeletedAt: &now, UpdatedAt: now}).Error
}
