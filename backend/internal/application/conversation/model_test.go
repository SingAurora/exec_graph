package conversation

import (
	"testing"

	applicationreview "github.com/singaurora/exec-graph/backend/internal/application/review"
)

func TestNormalizePlanningDraftRecoversCriteriaFromReply(t *testing.T) {
	draft := normalizePlanningDraft(ActionDraft{
		Title:               "洗澡",
		VerifiableGoal:      "完成一次洗澡",
		EvidenceRequirement: "记录实际做了什么。",
	}, nil, "行动时集中在三点：1）重点清洁腋下；2）洗完擦干身体；3）瓶罐放回原位。", true)

	if len(draft.AcceptanceCriteria) != 3 {
		t.Fatalf("got %d criteria, want 3: %#v", len(draft.AcceptanceCriteria), draft.AcceptanceCriteria)
	}
	if draft.AcceptanceCriteria[0] != "重点清洁腋下" || draft.AcceptanceCriteria[2] != "瓶罐放回原位" {
		t.Fatalf("unexpected criteria: %#v", draft.AcceptanceCriteria)
	}
}

func TestNormalizePlanningDraftKeepsPreviousCriteriaWhenModelOmitsThem(t *testing.T) {
	previous := &ActionDraft{
		Title:               "洗澡",
		VerifiableGoal:      "完成一次洗澡",
		AcceptanceCriteria:  []string{"重点清洁腋下", "洗完擦干身体"},
		EvidenceRequirement: "记录实际做了什么。",
	}
	draft := normalizePlanningDraft(ActionDraft{Title: "洗澡"}, previous, "我已按你的要求整理。", true)

	if len(draft.AcceptanceCriteria) != 2 {
		t.Fatalf("got %d criteria, want previous criteria preserved: %#v", len(draft.AcceptanceCriteria), draft.AcceptanceCriteria)
	}
	if draft.VerifiableGoal != previous.VerifiableGoal || draft.EvidenceRequirement != previous.EvidenceRequirement {
		t.Fatalf("previous draft fields were not preserved: %#v", draft)
	}
}

func TestNormalizeCompletionProgressFillsUnmentionedCriteria(t *testing.T) {
	progress := normalizeCompletionProgress(CompletionProgress{
		Confirmed: []CompletionProgressItem{{CriterionID: "C1", Reason: "用户明确说明已经完成。"}},
		Unclear:   []CompletionProgressItem{{CriterionID: "C2", Reason: "用户提到了，但没有说明是否收尾。"}},
	}, map[string]any{"node": map[string]any{"acceptanceCriteria": []applicationreview.Criterion{
		{ID: "C1", Text: "完成第一项", RequiredEvidence: "说明"},
		{ID: "C2", Text: "完成第二项", RequiredEvidence: "说明"},
		{ID: "C3", Text: "完成第三项", RequiredEvidence: "说明"},
	}}})

	if len(progress.Confirmed) != 1 || progress.Confirmed[0].Status != "confirmed" {
		t.Fatalf("unexpected confirmed progress: %#v", progress.Confirmed)
	}
	if len(progress.Unclear) != 1 || progress.Unclear[0].Status != "unclear" {
		t.Fatalf("unexpected unclear progress: %#v", progress.Unclear)
	}
	if len(progress.NotMentioned) != 1 || progress.NotMentioned[0].CriterionID != "C3" {
		t.Fatalf("expected C3 to be marked not mentioned: %#v", progress.NotMentioned)
	}
}

func TestNormalizeCompletionProgressRejectsUnknownAndDuplicateCriteria(t *testing.T) {
	progress := normalizeCompletionProgress(CompletionProgress{
		Confirmed: []CompletionProgressItem{
			{CriterionID: "C1", Reason: "第一条说明"},
			{CriterionID: "C1", Reason: "重复说明"},
			{CriterionID: "C9", Reason: "不存在的行动重点"},
		},
	}, map[string]any{"node": map[string]any{"acceptanceCriteria": []applicationreview.Criterion{{ID: "C1", Text: "完成第一项"}}}})

	if len(progress.Confirmed) != 1 || progress.Confirmed[0].Reason != "第一条说明" {
		t.Fatalf("unexpected normalized progress: %#v", progress.Confirmed)
	}
}
