package bootstrap

import (
	"testing"

	app "github.com/singaurora/exec-graph/backend/internal/application/generation"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
)

func TestFirstActionGenerationDoesNotRunAutomaticVerification(t *testing.T) {
	provider := &recordedProvider{}
	s := writeFixtureDependencies(t, nil, provider)
	jo := s.as(t, id.Demo("user", "jo"))
	input := generationInput(jo.graph(t).ID)
	accepted := decode[app.View](t, jo.call(t, "POST", "ai/generate", input, 200, id.New()))
	var row model.AIGeneration
	mustDB(t, s.deps.DB.Where("uuid = ?", accepted.GenerationID).Take(&row))
	if accepted.Status != "succeeded" || len(provider.requests) != 1 || row.PromptVersion != app.PromptVersion || row.InputTokens == nil || *row.InputTokens != 100 || row.OutputTokens == nil || *row.OutputTokens != 80 {
		t.Fatalf("首次行动不应自动核验: result=%+v calls=%d row=%+v", accepted, len(provider.requests), row)
	}
	jo.publish(t, *accepted.CreateAction)
}

func TestExplicitVerifyUsesStoredDraftWithoutRegenerating(t *testing.T) {
	provider := &recordedProvider{}
	s := writeFixtureDependencies(t, nil, provider)
	jo := s.as(t, id.Demo("user", "jo"))
	accepted := decode[app.View](t, jo.call(t, "POST", "ai/generate", generationInput(jo.graph(t).ID), 200, id.New()))
	verified := decode[app.VerifyView](t, jo.call(t, "POST", "ai/verify", app.VerifyInput{GenerationID: accepted.GenerationID}, 200, ""))
	if verified.Status != "passed" || verified.Message == "" || len(provider.requests) != 2 {
		t.Fatalf("显式核验未使用已存草稿: result=%+v calls=%d", verified, len(provider.requests))
	}
}

func TestChatRoutesVerificationWithoutFrontendKeyword(t *testing.T) {
	provider := &recordedProvider{}
	s := writeFixtureDependencies(t, nil, provider)
	jo := s.as(t, id.Demo("user", "jo"))
	accepted := decode[app.View](t, jo.call(t, "POST", "ai/generate", generationInput(jo.graph(t).ID), 200, id.New()))
	input := app.ChatInput{GenerateInput: generationInput(jo.graph(t).ID), GenerationID: accepted.GenerationID}
	input.Messages = []string{"看看这版能不能发布"}
	result := decode[app.ChatView](t, jo.call(t, "POST", "ai/chat", input, 200, id.New()))
	if result.Kind != "verification" || result.Verification == nil || result.Verification.Status != "passed" {
		t.Fatalf("对话没有路由到核验: %+v", result)
	}
	if len(provider.requests) != 3 {
		t.Fatalf("期望生成、意图路由、核验各一次，实际 %d", len(provider.requests))
	}
}
