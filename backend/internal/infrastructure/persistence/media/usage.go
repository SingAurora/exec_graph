package media

import (
	"fmt"
	"time"

	app "github.com/singaurora/exec-graph/backend/internal/application/media"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
	"gorm.io/gorm"
)

func usage(db *gorm.DB, owner string, now time.Time) (app.Usage, error) {
	var out app.Usage
	now = now.UTC()
	day := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	managed := func() *gorm.DB {
		// retention 是显式上传登记，不能按对象键猜测或把演示图片计为真实上传。
		return db.Model(&model.MediaAsset{}).
			Joins("JOIN media_retention ON media_retention.asset_uuid = media_assets.uuid").
			Where("media_assets.owner_uuid = ?", owner)
	}
	if err := managed().Where("media_assets.created_at >= ? AND media_assets.created_at <= ?", day, now).Count(&out.DailyRequests).Error; err != nil {
		return out, fmt.Errorf("统计账号每日上传用量失败: %w", err)
	}
	if err := managed().Where("media_assets.created_at >= ? AND media_assets.created_at <= ?", now.Add(-constants.UsageWindow), now).Count(&out.MinuteRequests).Error; err != nil {
		return out, fmt.Errorf("统计账号上传频率失败: %w", err)
	}
	if err := managed().Where("media_assets.deleted_at IS NULL").Select("COALESCE(SUM(media_assets.byte_size), 0)").Scan(&out.StorageBytes).Error; err != nil {
		return out, fmt.Errorf("统计账号图片容量失败: %w", err)
	}
	return out, nil
}
