package generation

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/singaurora/exec-graph/backend/internal/application/action"
	"github.com/singaurora/exec-graph/backend/internal/application/catalogue"
)

func TestParsePreservesExplicitAssessmentAndDocumentIntent(t *testing.T) {
	sources := []action.GenerationSource{{NodeID: "one", AgreementStatus: "unreviewed"}}
	base := `{"reply":"已整理","title":"骑行","objective":"骑了六公里","expression":{"mode":"inherit","markdown":""},"reviews":[{"sourceId":"one","complies":null}]}`
	draft, err := parse(base, "action", true, sources)
	if err != nil || draft.Reviews[0].Complies != nil || draft.Expression.Mode != "inherit" || draft.Expression.Markdown != nil {
		t.Fatalf("未知或继承语义被改变: %+v %v", draft, err)
	}
	for _, body := range []string{
		strings.Replace(base, `,"complies":null`, "", 1),
		strings.Replace(base, `"one"`, `"other"`, 1),
		strings.Replace(base, `"complies":null`, `"complies":false`, 1),
		strings.Replace(base, `"markdown":""`, `"markdown":"不应携带正文"`, 1),
		strings.Replace(base, `"objective":"骑了六公里"`, `"objective":""`, 1),
		strings.Replace(base, `"reviews":[`, `"reviews":[{"sourceId":"one","complies":true},`, 1),
	} {
		if _, err := parse(body, "action", true, sources); err == nil {
			t.Fatalf("无效模型响应被接受: %s", body)
		}
	}
	if _, err := parse(base, "action", false, sources); err == nil {
		t.Fatal("首次行动继承了不存在的表达")
	}
	if _, err := parse(base, "expression", false, sources); err == nil {
		t.Fatal("表达修改允许继承而非明确确认")
	}
	clear := `{"reply":"已清空","title":"","objective":"","expression":{"mode":"clear","markdown":""},"reviews":[]}`
	if draft, err := parse(clear, "expression", false, nil); err != nil || draft.Expression.Mode != "clear" {
		t.Fatalf("不能主动清空: %v", err)
	}
	exception := strings.Replace(base, `"complies":null`, `"complies":false,"exceptionReason":"忘记佩戴头盔"`, 1)
	if draft, err := parse(exception, "action", true, sources); err != nil || draft.Reviews[0].Complies == nil || *draft.Reviews[0].Complies {
		t.Fatalf("不满足约定不应被拒绝或视作满足: %v", err)
	}
}

func TestPromptOnlyUsesReachableFactsAndKeepsOriginalAgreements(t *testing.T) {
	graph := action.Graph{Nodes: []action.Node{{ID: "source", Agreement: action.Document{Markdown: "戴头盔"}}, {ID: "current", Expression: action.Document{Markdown: "慢一点"}}}, Edges: []action.Edge{{SourceID: "source", TargetID: "current", Kind: "primary"}}}
	nodes := []catalogue.ActionView{{ID: "source", ObjectiveMarkdown: "旧行动"}, {ID: "current", ObjectiveMarkdown: "本次行动"}, {ID: "unrelated", ObjectiveMarkdown: "不相关的秘密分支"}}
	messages, err := prompt(graph, map[string]bool{"source": true, "current": true}, nodes, Pending{Mode: "expression", NodeID: "current", InputMessage: "调整看法"}, false)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(messages[0].Content, "不相关的秘密分支") {
		t.Fatal("图内无关分支进入提示词")
	}
	position := strings.Index(messages[0].Content, "当前服务端快照：")
	var snapshot contextSnapshot
	if err := json.Unmarshal([]byte(messages[0].Content[position+len("当前服务端快照："):]), &snapshot); err != nil {
		t.Fatal(err)
	}
	if len(snapshot.Facts) != 2 || len(snapshot.OriginalSources) != 1 || snapshot.OriginalSources[0].Agreement != "戴头盔" || snapshot.CurrentExpression != "慢一点" {
		t.Fatalf("事实或原始约定丢失: %+v", snapshot)
	}
}
