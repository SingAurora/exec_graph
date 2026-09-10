package app

import (
	"encoding/json"
	"testing"
	"time"
)

func TestExtractJSONObjectAcceptsMarkdownFence(t *testing.T) {
	raw := "```json\n{\"verdict\":\"pass\",\"summary\":\"ok\"}\n```"
	got := extractJSONObject(raw)
	if got != `{"verdict":"pass","summary":"ok"}` {
		t.Fatalf("unexpected JSON extraction: %q", got)
	}
}

func TestNormalizeAIReviewOutputDowngradesIncompletePass(t *testing.T) {
	request := reviewExecutionNodeRequest{
		Title: "完成产品说明",
		AcceptanceCriteria: []reviewCriterionRequest{
			{ID: "c1", Text: "写出核心逻辑"},
			{ID: "c2", Text: "提供页面截图"},
		},
	}
	output := aiReviewModelOutput{
		Verdict: "pass",
		Summary: "看起来完成",
		CriterionReviews: []criterionReviewResponse{
			{CriterionID: "c1", Result: "met", Reason: "已经说明核心逻辑"},
		},
	}
	review := normalizeAIReviewOutput("review-test", time.Unix(0, 0), request, output)
	if review.Verdict != "partial" {
		t.Fatalf("expected incomplete pass to become partial, got %q", review.Verdict)
	}
	if len(review.CriterionReviews) != 2 {
		t.Fatalf("expected all criteria to be represented, got %d", len(review.CriterionReviews))
	}
	if review.CriterionReviews[1].Result != "unclear" {
		t.Fatalf("expected missing criterion to be unclear, got %q", review.CriterionReviews[1].Result)
	}
	if review.SuggestedSupplementTitle == "" {
		t.Fatalf("expected supplement title for non-pass review")
	}
	if _, err := json.Marshal(review); err != nil {
		t.Fatalf("review should marshal as JSON: %v", err)
	}
}

func TestNormalizeNodeDraftReviewOutputDefaultsUnknownVerdictToFail(t *testing.T) {
	review := normalizeNodeDraftReviewOutput("draft-review-test", time.Unix(0, 0), nodeDraftReviewModelOutput{
		Verdict: "maybe",
		Summary: "",
	})
	if review.Verdict != "fail" {
		t.Fatalf("expected unknown verdict to fail, got %q", review.Verdict)
	}
	if len(review.MissingRequirements) == 0 {
		t.Fatalf("expected a fallback missing requirement")
	}
}
