package bootstrap

import (
	"sync"
	"testing"
	"time"

	"github.com/singaurora/exec-graph/backend/internal/application/action"
	app "github.com/singaurora/exec-graph/backend/internal/application/generation"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
)

func generationInput(graph string) app.GenerateInput {
	return app.GenerateInput{Mode: "action", GraphID: graph, Message: "昨天实际骑行十二公里。", MergedParentIDs: []string{}, SourceVersions: []action.SourceVersion{}, Agreement: action.DocumentUpdate{Mode: "clear"}}
}

func TestRealGenerationAccountLimits(t *testing.T) {
	provider := &blockedProvider{entered: make(chan struct{}, 10), release: make(chan struct{})}
	s := writeFixtureDependencies(t, nil, provider)
	defer provider.unblock()
	limits := s.deps.Config.Limits
	limits.AI.DailyRequests, limits.AI.MinuteRequests, limits.AI.ConcurrentRequests = 3, 100, 1
	a, b := s.limited(t, limits), s.limited(t, limits)
	jo := a.as(t, id.Demo("user", "jo"))
	joOther := b.as(t, id.Demo("user", "jo"))
	lin := b.as(t, id.Demo("user", "lin"))
	input := generationInput(jo.graph(t).ID)
	key := id.New()
	done := make(chan commandOutcome, 2)
	go func() {
		r, err := jo.send("POST", "ai/generate", input, key)
		done <- commandOutcome{r, err}
	}()
	provider.await(t)
	// 网络调用不能持有账号锁；另一个实例可立即重放 pending 或拒绝新增调用。
	pending := decode[app.View](t, joOther.call(t, "POST", "ai/generate", input, 200, key))
	if pending.Status != "pending" {
		t.Fatalf("在途重放不是 pending: %+v", pending)
	}
	r, err := joOther.send("POST", "ai/generate", input, id.New())
	requireLimit(t, r, err)
	go func() {
		r, err := lin.send("POST", "ai/generate", input, id.New())
		done <- commandOutcome{r, err}
	}()
	provider.await(t) // 别人的在途调用不占本账号额度。
	provider.unblock()
	for i := 0; i < 2; i++ {
		out := <-done
		if out.err != nil || out.response.status != 200 {
			t.Fatalf("受理的调用没有完成: %+v", out)
		}
	}
	provider.provider.mu.Lock()
	provider.provider.fail = true
	provider.provider.mu.Unlock()
	failedKey := id.New()
	jo.call(t, "POST", "ai/generate", input, 503, failedKey)
	provider.provider.mu.Lock()
	provider.provider.fail = false
	provider.provider.mu.Unlock()
	jo.call(t, "POST", "ai/generate", input, 200, id.New())
	r, err = joOther.send("POST", "ai/generate", input, id.New())
	requireLimit(t, r, err)
	// 每日额度用尽后依然可以重放成功或失败；错误键输入仍为冲突。
	completed := decode[app.View](t, joOther.call(t, "POST", "ai/generate", input, 200, key))
	failed := decode[app.View](t, joOther.call(t, "POST", "ai/generate", input, 200, failedKey))
	if completed.Status != "succeeded" || completed.GenerationID != pending.GenerationID || failed.Status != "failed" {
		t.Fatal("超限后丢失原始结果")
	}
	input.Message = "更换内容不能复用原键"
	joOther.call(t, "POST", "ai/generate", input, 409, key)
	var count int64
	mustDB(t, s.deps.DB.Model(&model.IdempotencyRecord{}).Where("user_uuid = ? AND command = ?", id.Demo("user", "jo"), "ai/generate").Count(&count))
	if count != 3 {
		t.Fatalf("拒绝或重放消耗了次数，或失败未计数: %d", count)
	}
	provider.provider.mu.Lock()
	calls := len(provider.provider.requests)
	provider.provider.mu.Unlock()
	if calls != 4 { // 乔三次（包含失败），林岚一次。
		t.Fatalf("外部模型调用次数不正确: %d", calls)
	}

	t.Run("minute and concurrent new keys", func(t *testing.T) {
		limits.AI.DailyRequests, limits.AI.MinuteRequests = 100, 1
		first, second := s.limited(t, limits), s.limited(t, limits)
		clients := []writeClient{first.as(t, id.Demo("user", "miao")), second.as(t, id.Demo("user", "miao"))}
		input := generationInput(clients[0].graph(t).ID)
		start, results := make(chan struct{}), make(chan commandOutcome, 6)
		var wg sync.WaitGroup
		for i := 0; i < 6; i++ {
			wg.Add(1)
			go func(client writeClient) {
				defer wg.Done()
				<-start
				r, err := client.send("POST", "ai/generate", input, id.New())
				results <- commandOutcome{r, err}
			}(clients[i%2])
		}
		close(start)
		wg.Wait()
		close(results)
		accepted := 0
		for out := range results {
			if out.err == nil && out.response.status == 200 {
				accepted++
			} else {
				requireLimit(t, out.response, out.err)
			}
		}
		if accepted != 1 {
			t.Fatalf("并发突破滚动窗口: %d", accepted)
		}
		// 无需等待一分钟；将本测试已完成的登记移到窗口之外。
		mustDB(t, s.deps.DB.Model(&model.IdempotencyRecord{}).Where("user_uuid = ? AND command = ?", id.Demo("user", "miao"), "ai/generate").Update("created_at", time.Now().UTC().Add(-2*time.Minute)))
		clients[1].call(t, "POST", "ai/generate", input, 200, id.New())
	})

	t.Run("expired pending releases concurrent slot", func(t *testing.T) {
		limits.AI.DailyRequests, limits.AI.MinuteRequests = 100, 100
		client := s.limited(t, limits).as(t, id.Demo("user", "che"))
		input := generationInput(client.graph(t).ID)
		// 先得到真实生成，再模拟进程中断留下的 pending（清除全部成功专有字段）。
		view := decode[app.View](t, client.call(t, "POST", "ai/generate", input, 200, id.New()))
		mustDB(t, s.deps.DB.Model(&model.AIGeneration{}).Where("uuid = ?", view.GenerationID).Select("Status", "CompletedAt", "ConfirmedAt", "OutputMessageUUID", "CreatedAt").Updates(model.AIGeneration{Status: "pending", CreatedAt: time.Now().UTC().Add(-3 * time.Minute)}))
		client.call(t, "POST", "ai/generate", input, 200, id.New())
		status := decode[app.View](t, client.call(t, "GET", "ai/generation?generationId="+view.GenerationID, nil, 200, ""))
		if status.Status != "failed" || status.ErrorCode != "interrupted" {
			t.Fatal("中断占用没有在读取时结束")
		}
	})
	t.Run("UTC usage windows", func(t *testing.T) { verifyGenerationUsageWindows(t, s) })
}
