package action

import (
	"encoding/json"
	"testing"

	"github.com/singaurora/exec-graph/backend/internal/shared/id"
)

func TestSourceResolutionUsesOnlyReachableFacts(t *testing.T) {
	a, b, c, unrelated := id.New(), id.New(), id.New(), id.New()
	graph := Graph{Nodes: []Node{{ID: a, Version: 1, Level: 1}, {ID: b, Version: 2, Level: 2}, {ID: c, Version: 1, Level: 2}, {ID: unrelated, Version: 1, Level: 1}}, Edges: []Edge{{SourceID: a, TargetID: b, Kind: "primary"}, {SourceID: a, TargetID: c, Kind: "primary"}}}
	input := CreateActionInput{ParentID: b, MergedParentIDs: []string{c}, SourceVersions: []SourceVersion{{NodeID: c, Version: 1}, {NodeID: b, Version: 2}}, ReferenceAgreements: []SourceAssessment{{SourceID: b, Provided: true}, {SourceID: c, Provided: true}}}
	sources, count, level, err := ResolveSources(graph, input)
	if err != nil {
		t.Fatal(err)
	}
	if count != 3 || level != 3 || sources[0].NodeID != b || sources[0].Kind != "primary" || sources[1].NodeID != c {
		t.Fatal("共享历史重复计数、无关事实混入或主次关系丢失")
	}
	input.MergedParentIDs = []string{a}
	input.SourceVersions[0].NodeID, input.ReferenceAgreements[1].SourceID = a, a
	if _, _, _, err := ResolveSources(graph, input); err == nil {
		t.Fatal("不应合入主要来源已有的历史")
	}
}

func TestAgreementAssessmentPreservesUnknownAndExplicitClear(t *testing.T) {
	uuid := id.New()
	input := CreateActionInput{ParentID: uuid, MergedParentIDs: []string{}, SourceVersions: []SourceVersion{{NodeID: uuid, Version: 1}}, ReferenceAgreements: []SourceAssessment{{SourceID: uuid, Provided: true}}}
	graph := Graph{Nodes: []Node{{ID: uuid, Version: 1, Level: 1, Agreement: Document{ID: id.New(), Mode: "update", Markdown: "说明实际条件"}}}}
	sources, _, _, err := ResolveSources(graph, input)
	if err != nil || sources[0].AgreementStatus != "unreviewed" {
		t.Fatalf("未知被变成满足: %v", err)
	}
	graph.Nodes[0].Agreement.Mode, graph.Nodes[0].Agreement.Markdown = "clear", ""
	sources, _, _, err = ResolveSources(graph, input)
	if err != nil || sources[0].AgreementStatus != "unrestricted" || sources[0].AgreementID == "" {
		t.Fatalf("清空版本不能被丢弃: %v", err)
	}
	negative := false
	input.ReferenceAgreements[0].Complies = &negative
	if _, _, _, err := ResolveSources(graph, input); err == nil {
		t.Fatal("不满足不能省略理由")
	}
}

func TestDocumentIntentAndAssessmentPresence(t *testing.T) {
	empty, nonempty := " ", "真实内容"
	for _, sample := range []struct {
		doc            DocumentUpdate
		inherit, valid bool
	}{
		{DocumentUpdate{Mode: "inherit"}, true, true},
		{DocumentUpdate{Mode: "inherit"}, false, false},
		{DocumentUpdate{Mode: "clear"}, false, true},
		{DocumentUpdate{Mode: "clear", Markdown: &empty}, false, false},
		{DocumentUpdate{Mode: "update", Markdown: &empty}, false, false},
		{DocumentUpdate{Mode: "update", Markdown: &nonempty}, false, true},
	} {
		if err := ValidateDocument(sample.doc, sample.inherit); (err == nil) != sample.valid {
			t.Fatalf("文档意图判断错误: %+v err=%v", sample, err)
		}
	}
	var omitted, unknown SourceAssessment
	if err := json.Unmarshal([]byte(`{"sourceId":"x"}`), &omitted); err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal([]byte(`{"sourceId":"x","complies":null}`), &unknown); err != nil {
		t.Fatal(err)
	}
	if omitted.Provided || !unknown.Provided || unknown.Complies != nil {
		t.Fatal("complies 缺省和显式 null 混同")
	}
	if err := json.Unmarshal([]byte(`{"sourceId":"x","complies":null,"arbitrary":true}`), &unknown); err == nil {
		t.Fatal("未知核对字段应拒绝")
	}
}
