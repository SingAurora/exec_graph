package review

import (
	"testing"
	"time"
)

func TestNormalizeCompletionDowngradesIncompletePass(t *testing.T) {
	request := CompletionRequest{
		Title: "验证行动",
		AcceptanceCriteria: []Criterion{
			{ID: "C1", Text: "第一项完成"},
			{ID: "C2", Text: "第二项完成"},
		},
	}
	output := ModelOutput{
		Verdict: "pass",
		CriterionReviews: []CriterionResult{
			{CriterionID: "C1", Result: "met", Reason: "已有证据"},
		},
	}
	result := normalizeCompletion("review-1", time.Unix(1, 0), request, output)
	if result.Verdict != "partial" {
		t.Fatalf("verdict = %q, want partial", result.Verdict)
	}
	if len(result.CriterionReviews) != 2 || result.CriterionReviews[1].Result != "unclear" {
		t.Fatalf("unexpected criterion reviews: %+v", result.CriterionReviews)
	}
	if result.SuggestedSupplementTitle != "补齐「第二项完成」" {
		t.Fatalf("supplement title = %q", result.SuggestedSupplementTitle)
	}
}
