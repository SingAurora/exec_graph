package bootstrap

import (
	"context"
	"testing"
	"time"

	appgeneration "github.com/singaurora/exec-graph/backend/internal/application/generation"
	"github.com/singaurora/exec-graph/backend/internal/application/identity"
	generationstore "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/generation"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
)

func verifyGenerationUsageWindows(t *testing.T, s *writeSystem) {
	t.Helper()
	// 北京时间 08:00:20 对应 UTC 午夜；昨日最后一分钟也计入滚动窗口。
	now := time.Date(2026, 1, 2, 8, 0, 20, 0, time.FixedZone("CST", 8*60*60))
	actor := identity.Actor{UserID: id.Demo("user", "robin"), AuthVersion: 1}
	for _, created := range []time.Time{now.Add(-50 * time.Second), now.Add(-20 * time.Second), now.Add(-time.Second)} {
		mustDB(t, s.deps.DB.Create(&model.IdempotencyRecord{UserUUID: actor.UserID, Command: "ai/generate", RequestKey: id.New(), RequestSHA256: make([]byte, 32), Status: "processing", CreatedAt: created.UTC(), ExpiresAt: created.Add(24 * time.Hour).UTC()}))
	}
	store := generationstore.New(s.deps.DB)
	err := store.Within(context.Background(), actor, func(tx appgeneration.Transaction) error {
		usage, err := tx.Usage(now)
		if err != nil {
			return err
		}
		if usage.DailyRequests != 2 || usage.MinuteRequests != 3 || usage.PendingRequests != 0 {
			t.Errorf("UTC 午夜用量不正确: %+v", usage)
		}
		usage, err = tx.Usage(now.Add(24 * time.Hour))
		if err == nil && (usage.DailyRequests != 0 || usage.MinuteRequests != 0) {
			t.Errorf("次日没有重置: %+v", usage)
		}
		return err
	})
	if err != nil {
		t.Fatal(err)
	}
}
