package bootstrap

import (
	"context"
	"io"
	"log/slog"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	app "github.com/singaurora/exec-graph/backend/internal/application/generation"
	"github.com/singaurora/exec-graph/backend/internal/bootstrap/config"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
)

// limited 装配独立 HTTP 实例，共用真实数据库，验证限额不依赖进程内存。
func (s *writeSystem) limited(t *testing.T, limits config.Limits) *writeSystem {
	t.Helper()
	deps := *s.deps
	deps.Config.Limits = limits
	server := httptest.NewServer(HTTP(&deps, slog.New(slog.NewTextHandler(io.Discard, nil))))
	t.Cleanup(server.Close)
	return &writeSystem{&deps, server}
}

func requireLimit(t *testing.T, response commandResponse, err error) {
	t.Helper()
	if err != nil || response.status != 429 || response.code != fault.TooMany || response.message == "" || string(response.data) != "null" {
		t.Fatalf("应返回统一的超限提示: %+v %v", response, err)
	}
}

type commandOutcome struct {
	response commandResponse
	err      error
}

// blockedProvider 将首批外部调用保持在事务之外，便于实测同账号在途占用。
type blockedProvider struct {
	provider recordedProvider
	entered  chan struct{}
	release  chan struct{}
	once     sync.Once
}

func (p *blockedProvider) Model() string { return p.provider.Model() }
func (p *blockedProvider) Complete(ctx context.Context, messages []app.Message) (app.Completion, error) {
	select {
	case p.entered <- struct{}{}:
	case <-ctx.Done():
		return app.Completion{}, ctx.Err()
	}
	select {
	case <-p.release:
		return p.provider.Complete(ctx, messages)
	case <-ctx.Done():
		return app.Completion{}, ctx.Err()
	}
}
func (p *blockedProvider) unblock() { p.once.Do(func() { close(p.release) }) }
func (p *blockedProvider) await(t *testing.T) {
	t.Helper()
	select {
	case <-p.entered:
	case <-time.After(15 * time.Second):
		t.Fatal("请求没有进入外部模型调用，或账号事务锁未释放")
	}
}
