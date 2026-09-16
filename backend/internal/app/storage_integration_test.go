package app

import (
	"context"
	"os"
	"testing"

	infrastructurestorage "github.com/singaurora/exec-graph/backend/internal/infrastructure/storage"
	"time"
)

func TestObjectStorageConnection(t *testing.T) {
	if os.Getenv("EXEC_GRAPH_STORAGE_CHECK") != "1" {
		t.Skip("set EXEC_GRAPH_STORAGE_CHECK=1 to run the object storage integration check")
	}
	config, err := loadConfig("../../config.local.yaml")
	if err != nil {
		t.Fatalf("load local config: %v", err)
	}
	storage, err := infrastructurestorage.NewTencentCOS(config.Storage, config.Credentials)
	if err != nil {
		t.Fatalf("create COS client: %v", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := storage.Check(ctx); err != nil {
		t.Fatalf("check COS bucket: %v", err)
	}
}
