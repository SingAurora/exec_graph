package media

import (
	"os"
	"strings"
	"testing"
	"time"

	"github.com/singaurora/exec-graph/backend/internal/bootstrap/config"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/database"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
	"gorm.io/gorm"
)

func TestRealMediaUsageWindows(t *testing.T) {
	if os.Getenv("EXEC_GRAPH_INTEGRATION") != "1" {
		t.Skip("显式启用后才连接真实 MySQL")
	}
	c, err := config.Load(config.Path())
	if err != nil {
		t.Fatal(err)
	}
	c.Database.Schema = "eg_usage_" + strings.ReplaceAll(id.New(), "-", "")
	if err := database.CreateSchema(c.Database); err != nil {
		t.Fatal(err)
	}
	db, err := database.Open(c.Database)
	if err != nil {
		t.Fatal(err)
	}
	check := func(result *gorm.DB) {
		t.Helper()
		if result.Error != nil {
			t.Fatal(result.Error)
		}
	}
	t.Cleanup(func() {
		defer database.Close(db)
		check(db.Exec("DROP DATABASE `" + c.Database.Schema + "`"))
	})
	if err := db.AutoMigrate(&model.MediaAsset{}, &model.MediaRetention{}); err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 1, 2, 8, 0, 20, 0, time.FixedZone("CST", 8*60*60))
	owner, other, size := id.New(), id.New(), uint64(100)
	add := func(user string, created time.Time, managed, deleted bool) {
		t.Helper()
		asset := model.MediaAsset{UUID: id.New(), OwnerUUID: user, ObjectKey: "test/" + id.New(), Status: "pending", ByteSize: &size, CreatedAt: created.UTC()}
		if deleted {
			asset.Status, asset.DeletedAt = "deleted", &now
		}
		check(db.Create(&asset))
		if managed {
			check(db.Create(&model.MediaRetention{AssetUUID: asset.UUID, RetainUntil: now.Add(time.Hour).UTC(), NextAttemptAt: now.Add(time.Hour).UTC()}))
		}
	}
	add(owner, now.Add(-61*time.Second), true, false)
	add(owner, now.Add(-50*time.Second), true, false)
	add(owner, now.Add(-20*time.Second), true, false)
	add(owner, now.Add(-time.Second), true, true)
	add(owner, now.Add(-time.Second), false, false) // 演示导入没有生命周期登记。
	add(other, now.Add(-time.Second), true, false)
	for _, tc := range []struct {
		at            time.Time
		daily, minute int64
	}{
		{now, 2, 3},
		{now.Add(41 * time.Second), 2, 1},
		{now.Add(24 * time.Hour), 0, 0},
	} {
		out, err := usage(db, owner, tc.at)
		if err != nil || out.DailyRequests != tc.daily || out.MinuteRequests != tc.minute || out.StorageBytes != 300 {
			t.Fatalf("UTC／滚动窗口、删除计数、账号或演示隔离不正确: %+v %v", out, err)
		}
	}
}
