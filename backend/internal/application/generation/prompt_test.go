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
	base := `{"reply":"已整理","title":"骑行","objective":"骑了六公里","reviews":[{"sourceId":"one","complies":null}]}`
	draft, err := parse(base, "action", true, sources)
	if err != nil || draft.Reviews[0].Complies != nil || draft.Expression.Mode != "inherit" || draft.Expression.Markdown != nil {
		t.Fatalf("未知或继承语义被改变: %+v %v", draft, err)
	}
	for _, body := range []string{
		strings.Replace(base, `,"complies":null`, "", 1),
		strings.Replace(base, `"one"`, `"other"`, 1),
		strings.Replace(base, `"complies":null`, `"complies":false`, 1),
		strings.Replace(base, `"reviews":[`, `"expression":{"mode":"clear","markdown":""},"reviews":[`, 1),
		strings.Replace(base, `"objective":"骑了六公里"`, `"objective":""`, 1),
		strings.Replace(base, `"reviews":[`, `"reviews":[{"sourceId":"one","complies":true},`, 1),
		strings.Replace(base, `"reply":`, `"bypass":true,"reply":`, 1),
		base + `{}`,
	} {
		if _, err := parse(body, "action", true, sources); err == nil {
			t.Fatalf("无效模型响应被接受: %s", body)
		}
	}
	legacyExpression := strings.Replace(base, `,"reviews":[`, `,"expression":{"mode":"inherit","markdown":""},"reviews":[`, 1)
	if _, err := parse(legacyExpression, "action", false, sources); err == nil {
		t.Fatal("行动模式仍接受表达字段")
	}
	insufficient := strings.Replace(base, `"title":"骑行","objective":"骑了六公里"`, `"title":"","objective":""`, 1)
	if _, err := parse(insufficient, "action", true, sources); err == nil || !strings.Contains(err.Error(), "请补充这次实际做了什么") {
		t.Fatalf("缺少行动事实时没有返回明确提示: %v", err)
	}
	if _, err := parse(base, "expression", false, sources); err == nil {
		t.Fatal("表达修改允许继承而非明确确认")
	}
	clear := `{"reply":"已清空","title":"","objective":"","expression":{"mode":"clear","markdown":""},"reviews":[]}`
	if draft, err := parse(clear, "expression", false, nil); err != nil || draft.Expression.Mode != "clear" {
		t.Fatalf("不能主动清空: %v", err)
	}
	if _, err := parse(strings.Replace(clear, `"objective":""`, `"objective":"聊天中补充的新经历"`, 1), "expression", false, nil); err == nil {
		t.Fatal("表达修改夹带了新行动")
	}
	exception := strings.Replace(base, `"complies":null`, `"complies":false,"exceptionReason":"忘记佩戴头盔"`, 1)
	if draft, err := parse(exception, "action", true, sources); err != nil || draft.Reviews[0].Complies == nil || *draft.Reviews[0].Complies {
		t.Fatalf("不满足约定不应被拒绝或视作满足: %v", err)
	}
	unknownReason := strings.Replace(base, `"complies":null`, `"complies":null,"exceptionReason":"缺少记录用时的信息"`, 1)
	if draft, err := parse(unknownReason, "action", true, sources); err != nil || draft.Reviews[0].Complies != nil || draft.Reviews[0].ExceptionReason != nil {
		t.Fatalf("初稿未知状态的多余说明不能变成不符理由或阻止独立核验: %+v %v", draft, err)
	}
}

func TestParseAgreementModeReturnsOnlyAgreementDocument(t *testing.T) {
	input := `{"reply":"约定已整理","title":"","objective":"","agreement":{"mode":"update","markdown":"引用时记录本次实际完成的步骤"},"reviews":[]}`
	draft, err := parse(input, "agreement", false, nil)
	if err != nil || draft.Agreement == nil || draft.Agreement.Mode != "update" || draft.Agreement.Markdown == nil || *draft.Agreement.Markdown != "引用时记录本次实际完成的步骤" || draft.Title != "" || draft.Objective != "" || len(draft.Reviews) != 0 {
		t.Fatalf("约定草稿字段错误: %+v %v", draft, err)
	}
	cleared := strings.Replace(input, `"mode":"update","markdown":"引用时记录本次实际完成的步骤"`, `"mode":"clear","markdown":""`, 1)
	if draft, err := parse(cleared, "agreement", false, nil); err != nil || draft.Agreement == nil || draft.Agreement.Mode != "clear" {
		t.Fatalf("主动清空约定失败: %+v %v", draft, err)
	}
	for _, invalid := range []string{
		strings.Replace(input, `,"agreement":`, `,"unexpected":true,"agreement":`, 1),
		strings.Replace(input, `,"agreement":{"mode":"update","markdown":"引用时记录本次实际完成的步骤"}`, "", 1),
		strings.Replace(input, `"mode":"update","markdown":"引用时记录本次实际完成的步骤"`, `"mode":"inherit","markdown":""`, 1),
		strings.Replace(input, `"title":""`, `"title":"伪造行动"`, 1),
	} {
		if _, err := parse(invalid, "agreement", false, nil); err == nil {
			t.Fatalf("不合法约定输出被接受: %s", invalid)
		}
	}
}

func TestPromptOnlyUsesReachableFactsAndKeepsOriginalAgreements(t *testing.T) {
	graph := action.Graph{Nodes: []action.Node{{ID: "source", Agreement: action.Document{Markdown: "戴头盔"}}, {ID: "current", Expression: action.Document{Markdown: "慢一点"}}}, Edges: []action.Edge{{SourceID: "source", TargetID: "current", Kind: "primary"}}}
	nodes := []catalogue.ActionView{{ID: "source", ObjectiveMarkdown: "旧行动"}, {ID: "current", ObjectiveMarkdown: "本次行动"}, {ID: "unrelated", ObjectiveMarkdown: "不相关的秘密分支"}}
	pending := Pending{Mode: "expression", NodeID: "current", InputMessage: "调整看法"}
	messages, err := prompt(snapshotFor(graph, map[string]bool{"source": true, "current": true}, nodes, pending, false), pending)
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
