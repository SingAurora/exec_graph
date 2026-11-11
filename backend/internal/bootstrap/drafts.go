package bootstrap

import (
	"context"
	"log/slog"
	"time"

	appdraft "github.com/singaurora/exec-graph/backend/internal/application/draft"
	draftpersist "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/draft"
)

// maintainDrafts 定期删除 7 天未访问的云端草稿及其图片。
func maintainDrafts(ctx context.Context, deps *Dependencies, logger *slog.Logger) {
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()
	service := appdraft.New(draftpersist.New(deps.DB))
	for {
		deleted, err := service.Prune(ctx, time.Now().UTC(), 100)
		if err != nil && ctx.Err() == nil {
			logger.Error("云端草稿清理未全部完成", "error", err)
		}
		if deleted > 0 {
			logger.Info("过期云端草稿已清理", "deleted", deleted)
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
