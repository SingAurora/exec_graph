package storage_test

import (
	"context"
	"os"
	"testing"

	bootstrapconfig "github.com/singaurora/exec-graph/backend/internal/bootstrap/config"
	infrastructurestorage "github.com/singaurora/exec-graph/backend/internal/infrastructure/storage"
	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
)

func TestObjectStorageConnection(t *testing.T) {
	if os.Getenv("EXEC_GRAPH_STORAGE_CHECK") != "1" {
		t.Skip("set EXEC_GRAPH_STORAGE_CHECK=1 to run the object storage integration check")
	}
	config, err := bootstrapconfig.Load("../../../etc/config.local.yaml")
	if err != nil {
		t.Fatalf("load local config: %v", err)
	}
	storage, err := infrastructurestorage.NewTencentCOS(config.Storage, config.Credentials)
	if err != nil {
		t.Fatalf("create object storage client: %v", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), sharedconstants.WorkOverviewTimeout)
	defer cancel()
	if err := storage.Check(ctx); err != nil {
		t.Fatalf("check object storage bucket: %v", err)
	}
}
