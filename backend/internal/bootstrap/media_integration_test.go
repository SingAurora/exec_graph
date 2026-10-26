package bootstrap

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/singaurora/exec-graph/backend/internal/application/catalogue"
	"github.com/singaurora/exec-graph/backend/internal/application/graph"
	app "github.com/singaurora/exec-graph/backend/internal/application/media"
	store "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/media"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/storage/demomedia"
	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
	"gorm.io/gorm"
)

func TestRealMediaLifecycleAndCleanup(t *testing.T) {
	objects := &memoryObjects{files: map[string][]byte{}}
	s := writeFixture(t, objects)
	jo, lin := s.as(t, id.Demo("user", "jo")), s.as(t, id.Demo("user", "lin"))
	anon := writeClient{url: s.server.URL, http: jo.http}
	body, err := (demomedia.Files{}).Read(context.Background(), "demo/v1/demo-cycling.jpg")
	if err != nil {
		t.Fatal(err)
	}
	jo.upload(t, []byte("<svg>not an image</svg>"), 400)
	badCSRF := jo
	badCSRF.csrf = "incorrect"
	badCSRF.upload(t, body, 403)
	anonymous := jo
	anonymous.token = ""
	anonymous.upload(t, body, 401)
	jo.upload(t, make([]byte, constants.MaxImageBytes+1), 400)
	upload := jo.upload(t, body, 200)
	if upload.MIMEType != "image/jpeg" || upload.Width == 0 || upload.AssetID == "" || upload.RetainUntil.Before(time.Now().Add(23*time.Hour)) {
		t.Fatalf("上传返回不完整: %+v", upload)
	}
	jo.image(t, upload.URL, 200, body)
	lin.image(t, upload.URL, 404, nil)
	anon.image(t, upload.URL, 404, nil)
	lin.call(t, "POST", "media/retain", app.RetainInput{AssetIDs: []string{upload.AssetID}}, 403, "")
	jo.call(t, "POST", "media/retain", app.RetainInput{AssetIDs: []string{upload.AssetID, upload.AssetID}}, 400, "")
	retained := decode[app.RetentionView](t, jo.call(t, "POST", "media/retain", app.RetainInput{AssetIDs: []string{upload.AssetID}}, 200, ""))
	if retained.RetainUntil.Before(time.Now().Add(6 * 24 * time.Hour)) {
		t.Fatal("草稿没有续期七天")
	}
	unused := jo.upload(t, body, 200)
	saved := jo.upload(t, body, 200)
	historical := jo.upload(t, body, 200)
	g := jo.graph(t)
	input := graph.UpdateGraphInput{GraphID: g.ID, Title: g.Title, Description: g.Description, ExpectedVersion: g.Version, AvatarAssetID: &saved.AssetID}
	view := decode[catalogue.GraphView](t, jo.call(t, "POST", "graphs/update", input, 200, ""))
	if view.AvatarAssetID == nil || *view.AvatarAssetID != saved.AssetID {
		t.Fatal("图读取没有返回稳定资产身份")
	}
	anon.image(t, saved.URL, 200, body)
	var version model.DocumentVersion
	mustDB(t, s.deps.DB.Order("id").Take(&version))
	mustDB(t, s.deps.DB.Create(&model.DocumentImage{DocumentVersionUUID: version.UUID, AssetUUID: historical.AssetID, Position: 1}))
	now := time.Now().UTC()
	expire := func(ids ...string) {
		t.Helper()
		mustDB(t, s.deps.DB.Model(&model.MediaRetention{}).Where("asset_uuid IN ?", ids).Updates(model.MediaRetention{RetainUntil: now.Add(-time.Hour), NextAttemptAt: now.Add(-time.Hour)}))
	}
	expire(unused.AssetID, saved.AssetID, historical.AssetID)
	service := app.New(store.New(s.deps.DB), objects, mediaLimits(s.deps.Config))
	report, err := service.Prune(context.Background(), now)
	if err != nil || report.Deleted != 1 || report.Failed != 0 {
		t.Fatalf("应只删除未引用图片: %+v %v", report, err)
	}
	jo.image(t, unused.URL, 404, nil)
	jo.image(t, upload.URL, 200, body)
	anon.image(t, saved.URL, 200, body)
	jo.image(t, historical.URL, 200, body)
	// 云端删除失败时先禁止再次保存；随后从持久化认领记录重试。
	retry := jo.upload(t, body, 200)
	expire(retry.AssetID)
	objects.failDelete = true
	report, err = service.Prune(context.Background(), now)
	if err == nil || report.Failed != 1 || report.Deleted != 0 {
		t.Fatalf("没有保留失败重试状态: %+v %v", report, err)
	}
	var row model.MediaAsset
	mustDB(t, s.deps.DB.Where("uuid = ?", retry.AssetID).Take(&row))
	if row.DeletedAt != nil {
		t.Fatal("云端失败时提前标记了删除")
	}
	jo.call(t, "POST", "media/retain", app.RetainInput{AssetIDs: []string{retry.AssetID}}, 409, "")
	input.ExpectedVersion, input.AvatarAssetID = view.Version, &retry.AssetID
	jo.call(t, "POST", "graphs/update", input, 409, "")
	objects.failDelete = false
	report, err = service.Prune(context.Background(), now.Add(constants.MediaRetryDelay+time.Second))
	if err != nil || report.Deleted != 1 {
		t.Fatalf("失败任务没有恢复: %+v %v", report, err)
	}
	// 上传响应中断时，即使文件已存在，也能通过 pending 登记找回删除。
	objects.failPut = true
	jo.upload(t, body, 500)
	objects.failPut = false
	var pending model.MediaAsset
	mustDB(t, s.deps.DB.Where("status = ?", "pending").Take(&pending))
	expire(pending.UUID)
	report, err = service.Prune(context.Background(), now)
	if err != nil || report.Deleted != 1 {
		t.Fatalf("中断上传没有回收: %+v %v", report, err)
	}
	var demoCount int64
	mustDB(t, s.deps.DB.Model(&model.MediaAsset{}).Where("object_key LIKE ? AND deleted_at IS NULL", "demo/v1/%").Count(&demoCount))
	if demoCount != 7 {
		t.Fatalf("清理误伤了演示资产: %d", demoCount)
	}
	// 实际保存已持有资产锁时，回收必须等待提交并看到最新引用。
	race := jo.upload(t, body, 200)
	expire(race.AssetID)
	entered, release := make(chan struct{}), make(chan struct{})
	var unblock sync.Once
	unblockSave := func() { unblock.Do(func() { close(release) }) }
	defer unblockSave()
	if err := s.deps.DB.Callback().Update().Before("gorm:update").Register("media_test:block_save", func(tx *gorm.DB) {
		if tx.Statement.Table == "graphs" {
			close(entered)
			<-release
		}
	}); err != nil {
		t.Fatal(err)
	}
	saveDone := make(chan commandResponse, 1)
	errorDone := make(chan error, 1)
	input.AvatarAssetID = &race.AssetID
	go func() {
		result, err := jo.send("POST", "graphs/update", input, "")
		saveDone <- result
		errorDone <- err
	}()
	select {
	case <-entered:
	case <-time.After(10 * time.Second):
		t.Fatal("保存没有进入持锁阶段")
	}
	claimDone := make(chan *app.CleanupTarget, 1)
	claimError := make(chan error, 1)
	go func() {
		result, err := store.New(s.deps.DB).Claim(context.Background(), race.AssetID, now)
		claimDone <- result
		claimError <- err
	}()
	select {
	case <-claimDone:
		unblockSave()
		t.Fatal("清理未等待保存的资产锁")
	case <-time.After(100 * time.Millisecond):
		unblockSave()
	}
	if result, err := <-saveDone, <-errorDone; err != nil || result.status != 200 {
		t.Fatalf("保存失败: %+v %v", result, err)
	}
	if result, err := <-claimDone, <-claimError; err != nil || result != nil {
		t.Fatalf("已保存图片被认领删除: %+v %v", result, err)
	}
	if err := s.deps.DB.Callback().Update().Remove("media_test:block_save"); err != nil {
		t.Fatal(err)
	}
	anon.image(t, race.URL, 200, body)
}
