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
