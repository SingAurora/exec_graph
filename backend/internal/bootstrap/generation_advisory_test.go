package bootstrap

import (
	"testing"

	app "github.com/singaurora/exec-graph/backend/internal/application/generation"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
)

func TestGenerationDoesNotRunAutomaticVerification(t *testing.T) {
	provider := &recordedProvider{reject: true}
	s := writeFixtureDependencies(t, nil, provider)
	jo := s.as(t, id.Demo("user", "jo"))
	accepted := decode[app.View](t, jo.call(t, "POST", "ai/generate", generationInput(jo.graph(t).ID), 200, id.New()))
	if accepted.Status != "succeeded" || accepted.Draft == nil || accepted.CreateAction == nil {
		t.Fatalf("生成应直接返回草稿: %+v", accepted)
	}
	if len(provider.requests) != 1 {
		t.Fatalf("生成阶段不应自动调用核验器: %d", len(provider.requests))
	}
}
