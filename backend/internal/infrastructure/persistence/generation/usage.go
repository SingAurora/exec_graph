package generation

import (
	"fmt"
	"time"

	app "github.com/singaurora/exec-graph/backend/internal/application/generation"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
)

func (t *generationTransaction) Usage(now time.Time) (app.Usage, error) {
	var out app.Usage
	now = now.UTC()
	day := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	// 幂等登记代表已受理的真实调用，演示导入没有这类登记，不消耗配额。
	attempts := func(since time.Time, count *int64) error {
		return t.DB.Model(&model.IdempotencyRecord{}).
			Where("user_uuid = ? AND command = ? AND created_at >= ? AND created_at <= ?", t.Actor.UserID, "ai/generate", since, now).Count(count).Error
	}
	if err := attempts(day, &out.DailyRequests); err != nil {
		return out, fmt.Errorf("统计账号每日生成用量失败: %w", err)
	}
	if err := attempts(now.Add(-constants.UsageWindow), &out.MinuteRequests); err != nil {
		return out, fmt.Errorf("统计账号生成频率失败: %w", err)
	}
	err := t.DB.Model(&model.AIGeneration{}).
		Where("requested_by_uuid = ? AND status = ? AND created_at >= ?", t.Actor.UserID, "pending", now.Add(-constants.AIPendingTimeout)).Count(&out.PendingRequests).Error
	if err != nil {
		return out, fmt.Errorf("统计账号在途生成失败: %w", err)
	}
	return out, nil
}
