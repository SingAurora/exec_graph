package app

import (
	"context"
	"os"
	"testing"

	infrastructurestorage "github.com/singaurora/exec-graph/backend/internal/infrastructure/storage"
	"time"
)

func TestCOSBucketConnection(t *testing.T) {
	if os.Getenv("EXEC_GRAPH_COS_CHECK") != "1" {
		t.Skip("set EXEC_GRAPH_COS_CHECK=1 to run the Tencent COS integration check")
	}
	config, err := loadConfig("../../config.local.yaml")
	if err != nil {
		t.Fatalf("load local config: %v", err)
	}
	storage, err := infrastructurestorage.NewTencentCOS(config.Tencent.COS, config.Tencent.SES)
	if err != nil {
		t.Fatalf("create COS client: %v", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := storage.Check(ctx); err != nil {
		t.Fatalf("check COS bucket: %v", err)
	}
}
