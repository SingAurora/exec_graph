package bootstrap

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/singaurora/exec-graph/backend/internal/application/catalogue"
	"github.com/singaurora/exec-graph/backend/internal/application/graph"
	app "github.com/singaurora/exec-graph/backend/internal/application/media"
	"github.com/singaurora/exec-graph/backend/internal/bootstrap/config"
	store "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/media"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/storage"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/storage/demomedia"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
)

func TestRealCloudMediaUploadReadAndCleanup(t *testing.T) {
	if os.Getenv("EXEC_GRAPH_STORAGE_INTEGRATION") != "1" || os.Getenv("EXEC_GRAPH_INTEGRATION") != "1" {
		t.Skip("同时显式启用数据库和真实对象存储验证")
	}
	c, err := config.Load(config.Path())
	if err != nil {
		t.Fatal(err)
	}
	c.Storage.Enabled, c.Storage.MediaPrefix = true, "exec-graph/integration/"+id.New()+"/media"
	objects, err := storage.New(c.Storage, c.Credentials)
	if err != nil {
		t.Fatal(err)
	}
	s := writeFixture(t, objects)
	// 只清理本次唯一前缀中登记的测试对象；即使断言失败，也不会留下已上传文件。
	t.Cleanup(func() {
		var assets []model.MediaAsset
		if err := s.deps.DB.Where("object_key LIKE ?", c.Storage.MediaPrefix+"/%").Find(&assets).Error; err != nil {
			t.Error(err)
			return
		}
		for _, asset := range assets {
			if err := objects.Delete(context.Background(), asset.ObjectKey); err != nil {
				t.Error(err)
			}
		}
	})
	jo := s.as(t, id.Demo("user", "jo"))
	anon := writeClient{url: s.server.URL, http: jo.http}
	body, err := (demomedia.Files{}).Read(context.Background(), "demo/v1/demo-cycling.jpg")
	if err != nil {
		t.Fatal(err)
	}
	upload := jo.upload(t, body, 200)
	jo.image(t, upload.URL, 200, body)
	anon.image(t, upload.URL, 404, nil)
	g := jo.graph(t)
	input := graph.UpdateGraphInput{GraphID: g.ID, Title: g.Title, Description: g.Description, ExpectedVersion: g.Version, AvatarAssetID: &upload.AssetID}
	view := decode[catalogue.GraphView](t, jo.call(t, "POST", "graphs/update", input, 200, ""))
	anon.image(t, upload.URL, 200, body)
	now := time.Now().UTC()
	mustDB(t, s.deps.DB.Model(&model.MediaRetention{}).Where("asset_uuid = ?", upload.AssetID).Updates(model.MediaRetention{RetainUntil: now.Add(-time.Hour), NextAttemptAt: now.Add(-time.Hour)}))
	service := app.New(store.New(s.deps.DB), objects, mediaLimits(s.deps.Config))
	report, err := service.Prune(context.Background(), now)
	if err != nil || report.Deleted != 0 {
		t.Fatalf("云端已引用资产被回收: %+v %v", report, err)
	}
	input.ExpectedVersion, input.AvatarAssetID = view.Version, nil
	jo.call(t, "POST", "graphs/update", input, 200, "")
	mustDB(t, s.deps.DB.Model(&model.MediaRetention{}).Where("asset_uuid = ?", upload.AssetID).Updates(model.MediaRetention{RetainUntil: now.Add(-time.Hour), NextAttemptAt: now.Add(-time.Hour)}))
	report, err = service.Prune(context.Background(), now)
	if err != nil || report.Deleted != 1 {
		t.Fatalf("云端未引用资产没有回收: %+v %v", report, err)
	}
	jo.image(t, upload.URL, 404, nil)
	var asset model.MediaAsset
	mustDB(t, s.deps.DB.Where("uuid = ?", upload.AssetID).Take(&asset))
	if _, err := objects.Read(context.Background(), asset.ObjectKey); err == nil {
		t.Fatal("数据库标记删除但真实云文件仍存在")
	}
}
