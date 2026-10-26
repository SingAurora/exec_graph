package bootstrap

import (
	"context"
	"sync"
	"testing"
	"time"

	app "github.com/singaurora/exec-graph/backend/internal/application/media"
	store "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/media"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/storage/demomedia"
	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
)

func TestRealMediaAccountLimits(t *testing.T) {
	objects := &memoryObjects{files: map[string][]byte{}}
	s := writeFixture(t, objects)
	body, err := (demomedia.Files{}).Read(context.Background(), "demo/v1/demo-cycling.jpg")
	if err != nil {
		t.Fatal(err)
	}
	limits := s.deps.Config.Limits
	limits.Media.DailyRequests, limits.Media.MinuteRequests = 100, 100
	limits.Media.StorageBytes = uint64(len(body))
	a, b := s.limited(t, limits), s.limited(t, limits)
	clients := []writeClient{a.as(t, id.Demo("user", "jo")), b.as(t, id.Demo("user", "jo"))}
	start, results := make(chan struct{}), make(chan commandOutcome, 6)
	var wg sync.WaitGroup
	for i := 0; i < 6; i++ {
		wg.Add(1)
		go func(client writeClient) {
			defer wg.Done()
			<-start
			r, err := client.sendUpload(body)
			results <- commandOutcome{r, err}
		}(clients[i%2])
	}
	close(start)
	wg.Wait()
	close(results)
	var uploaded []app.AssetView
	for out := range results {
		if out.err == nil && out.response.status == 200 {
			uploaded = append(uploaded, decode[app.AssetView](t, out.response.data))
		} else {
			requireLimit(t, out.response, out.err)
		}
	}
	if len(uploaded) != 1 {
		t.Fatalf("并发突破图片容量，或演示图片消耗了额度: %d", len(uploaded))
	}
	asset := uploaded[0]
	clients[0].call(t, "POST", "media/retain", app.RetainInput{AssetIDs: []string{asset.AssetID}}, 200, "")
	assertUploadCount(t, s, "jo", 1)
	// 认领及删除失败不能提前释放容量；删除成功后新上传才可受理。
	now := time.Now().UTC()
	mustDB(t, s.deps.DB.Model(&model.MediaRetention{}).Where("asset_uuid = ?", asset.AssetID).Updates(model.MediaRetention{RetainUntil: now.Add(-time.Hour), NextAttemptAt: now.Add(-time.Hour)}))
	service := app.New(store.New(s.deps.DB), objects, mediaLimits(a.deps.Config))
	objects.failDelete = true
	report, err := service.Prune(context.Background(), now)
	if err == nil || report.Failed != 1 {
		t.Fatalf("没有模拟云端删除失败: %+v %v", report, err)
	}
	r, err := clients[1].sendUpload(body)
	requireLimit(t, r, err)
	objects.failDelete = false
	report, err = service.Prune(context.Background(), now.Add(constants.MediaRetryDelay+time.Second))
	if err != nil || report.Deleted != 1 {
		t.Fatalf("删除重试未完成: %+v %v", report, err)
	}
	clients[1].upload(t, body, 200)
	assertUploadCount(t, s, "jo", 2) // 逻辑删除仍保留当天受理计数。

	t.Run("failed upload keeps capacity", func(t *testing.T) {
		lin := a.as(t, id.Demo("user", "lin"))
		objects.failPut = true
		lin.upload(t, body, 500)
		objects.failPut = false
		r, err := lin.sendUpload(body)
		requireLimit(t, r, err)
		assertUploadCount(t, s, "lin", 1)
	})
	t.Run("daily includes failed and deleted uploads", func(t *testing.T) {
		limits.Media.DailyRequests = 2
		limits.Media.StorageBytes = constants.DefaultMediaStorageBytes
		client := s.limited(t, limits).as(t, id.Demo("user", "jo"))
		r, err := client.sendUpload(body)
		requireLimit(t, r, err)
		limits.Media.DailyRequests = 1
		client = s.limited(t, limits).as(t, id.Demo("user", "lin"))
		r, err = client.sendUpload(body)
		requireLimit(t, r, err)
		assertUploadCount(t, s, "jo", 2)
		assertUploadCount(t, s, "lin", 1)
	})
	t.Run("minute window", func(t *testing.T) {
		limits.Media.DailyRequests, limits.Media.MinuteRequests = 100, 1
		client := s.limited(t, limits).as(t, id.Demo("user", "miao"))
		client.upload(t, body, 200)
		r, err := client.sendUpload(body)
		requireLimit(t, r, err)
		mustDB(t, s.deps.DB.Model(&model.MediaAsset{}).Where("owner_uuid = ? AND object_key LIKE ?", id.Demo("user", "miao"), "test/media/%").Update("created_at", time.Now().UTC().Add(-2*time.Minute)))
		client.upload(t, body, 200)
		assertUploadCount(t, s, "miao", 2)
	})
	objects.mu.Lock()
	puts := len(objects.files)
	objects.mu.Unlock()
	// 乔保留一张、林岚失败但已写入一张、miao两张。
	if puts != 4 {
		t.Fatalf("被拒绝的上传仍访问了对象存储: %d", puts)
	}
}

func assertUploadCount(t *testing.T, s *writeSystem, user string, want int64) {
	t.Helper()
	var count int64
	mustDB(t, s.deps.DB.Model(&model.MediaAsset{}).Joins("JOIN media_retention ON media_retention.asset_uuid = media_assets.uuid").Where("media_assets.owner_uuid = ?", id.Demo("user", user)).Count(&count))
	if count != want {
		t.Fatalf("上传受理计数不正确: %d，期望 %d", count, want)
	}
}
