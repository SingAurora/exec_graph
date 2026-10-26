package bootstrap

import (
	"context"
	"log/slog"
	"time"

	app "github.com/singaurora/exec-graph/backend/internal/application/media"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/media"
	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
)

// PruneMedia 执行一批已登记且到期的上传回收，不扫描存储桶。
func PruneMedia(ctx context.Context, deps *Dependencies) (app.CleanupReport, error) {
	if !deps.Config.Storage.Enabled || deps.Objects == nil {
		return app.CleanupReport{}, fault.New(fault.Unavailable, "对象存储未启用，不执行图片清理")
	}
	return app.New(media.New(deps.DB), deps.Objects).Prune(ctx, time.Now().UTC())
}

// maintainMedia 与 API 生命周期一致；多进程通过数据库认领协调，不依赖本地内存任务状态。
func maintainMedia(ctx context.Context, deps *Dependencies, logger *slog.Logger) {
	if !deps.Config.Storage.Enabled {
		return
	}
	ticker := time.NewTicker(constants.MediaCleanupInterval)
	defer ticker.Stop()
	for {
		report, err := PruneMedia(ctx, deps)
		if err != nil && ctx.Err() == nil {
			logger.Error("图片回收未全部完成，将按保留记录重试", "error", err)
		}
		if report.Deleted > 0 {
			logger.Info("未引用图片已回收", "deleted", report.Deleted, "failed", report.Failed)
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
