package bootstrap

import (
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
}
