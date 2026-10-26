package bootstrap

import (
	"github.com/singaurora/exec-graph/backend/internal/application/generation"
	"github.com/singaurora/exec-graph/backend/internal/application/media"
	"github.com/singaurora/exec-graph/backend/internal/bootstrap/config"
)

func generationLimits(c config.Config) generation.Limits {
	return generation.Limits{DailyRequests: c.Limits.AI.DailyRequests, MinuteRequests: c.Limits.AI.MinuteRequests, ConcurrentRequests: c.Limits.AI.ConcurrentRequests}
}

func mediaLimits(c config.Config) media.Limits {
	return media.Limits{DailyRequests: c.Limits.Media.DailyRequests, MinuteRequests: c.Limits.Media.MinuteRequests, StorageBytes: c.Limits.Media.StorageBytes}
}
