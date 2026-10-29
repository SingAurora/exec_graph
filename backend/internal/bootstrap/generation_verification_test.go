package bootstrap

import (
	"testing"

	"github.com/singaurora/exec-graph/backend/internal/application/action"
	app "github.com/singaurora/exec-graph/backend/internal/application/generation"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
)

func TestRealGenerationRequiresIndependentVerification(t *testing.T) {
	provider := &recordedProvider{}
	s := writeFixtureDependencies(t, nil, provider)
	jo := s.as(t, id.Demo("user", "jo"))
	input := generationInput(jo.graph(t).ID)
	for _, test := range []struct {
		name            string
		providerFailure bool
		status          int
		code            string
	}{
		{"content rejected", false, 400, "content_unverified"},
		{"verifier unavailable", true, 503, "provider_failed"},
	} {
		t.Run(test.name, func(t *testing.T) {
			provider.reject, provider.failVerification = !test.providerFailure, test.providerFailure
			key := id.New()
			jo.call(t, "POST", "ai/generate", input, test.status, key)
			calls := len(provider.requests)
			failed := decode[app.View](t, jo.call(t, "POST", "ai/generate", input, 200, key))
			if failed.Status != "failed" || failed.ErrorCode != test.code || failed.Draft != nil || failed.CreateAction != nil || calls != len(provider.requests) {
				t.Fatalf("未核验结果被作为成功草稿返回或重放再次调用模型: %+v", failed)
			}
			var row model.AIGeneration
			mustDB(t, s.deps.DB.Where("uuid = ?", failed.GenerationID).Take(&row))
			if row.OutputMessageUUID != nil || row.GeneratedTitle != nil || row.ObjectiveMarkdown != nil {
				t.Fatal("未通过核验的生成正文被保存为可确认输出")
			}
			confirmation := action.CreateActionInput{GraphID: input.GraphID, GenerationID: failed.GenerationID, MergedParentIDs: []string{}, SourceVersions: []action.SourceVersion{}, ReferenceAgreements: []action.SourceAssessment{}, Images: []action.ImageInput{}}
			jo.call(t, "POST", "actions/create", confirmation, 409, id.New())
		})
	}
	provider.reject, provider.failVerification = false, false
	accepted := decode[app.View](t, jo.call(t, "POST", "ai/generate", input, 200, id.New()))
	var row model.AIGeneration
	mustDB(t, s.deps.DB.Where("uuid = ?", accepted.GenerationID).Take(&row))
	if row.PromptVersion != app.PromptVersion || row.InputTokens == nil || *row.InputTokens != 160 || row.OutputTokens == nil || *row.OutputTokens != 120 {
		t.Fatalf("没有记录核验规则版本及两轮用量: %+v", row)
	}
	jo.publish(t, *accepted.CreateAction)
}
