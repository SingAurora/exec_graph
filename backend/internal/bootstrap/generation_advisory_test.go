package bootstrap

import (
	"strings"
	"testing"

	app "github.com/singaurora/exec-graph/backend/internal/application/generation"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
)

func TestVerificationFailureKeepsDraftForUserReview(t *testing.T) {
	provider := &recordedProvider{reject: true}
	s := writeFixtureDependencies(t, nil, provider)
	jo := s.as(t, id.Demo("user", "jo"))
	accepted := decode[app.View](t, jo.call(t, "POST", "ai/generate", generationInput(jo.graph(t).ID), 200, id.New()))
	if accepted.Status != "succeeded" || accepted.Draft == nil || accepted.CreateAction == nil {
		t.Fatalf("核验拒绝不应丢弃可用草稿: %+v", accepted)
	}
	if len(provider.requests) != 2 {
		t.Fatalf("仍然应该执行一次建议性核验: %d", len(provider.requests))
	}
	if !strings.Contains(accepted.Draft.Reply, "计划、预测或评价") {
		t.Fatalf("核验失败后应给出改写引导: %q", accepted.Draft.Reply)
	}
}

func TestRewriteRequestKeepsModelDraftAndUsesSpecificReply(t *testing.T) {
	provider := &recordedProvider{reject: true}
	s := writeFixtureDependencies(t, nil, provider)
	jo := s.as(t, id.Demo("user", "jo"))
	input := generationInput(jo.graph(t).ID)
	input.Messages = []string{"这确实是我做过的事情，可能表达有问题，你帮我改写一下"}
	accepted := decode[app.View](t, jo.call(t, "POST", "ai/generate", input, 200, id.New()))
	if accepted.Status != "succeeded" || accepted.Draft == nil {
		t.Fatalf("改写请求不应丢弃草稿: %+v", accepted)
	}
	if !strings.Contains(accepted.Draft.Reply, "重新整理了一版") || strings.Contains(accepted.Draft.Reply, "这通常是因为计划") {
		t.Fatalf("改写请求不应重复通用引导: %q", accepted.Draft.Reply)
	}
	if len(provider.requests) == 0 || !strings.Contains(provider.requests[0][0].Content, "本轮是改写请求") {
		t.Fatal("改写请求没有进入生成提示词")
	}
}
