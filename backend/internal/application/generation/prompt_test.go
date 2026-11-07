package generation

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/singaurora/exec-graph/backend/internal/application/action"
	"github.com/singaurora/exec-graph/backend/internal/application/catalogue"
	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
)

func TestParsePreservesExplicitAssessmentAndDocumentIntent(t *testing.T) {
	sources := []action.GenerationSource{{NodeID: "one", AgreementStatus: "unreviewed"}}
	base := `{"reply":"已整理","title":"骑行","objective":"骑了六公里","reviews":[{"sourceId":"one","complies":null}]}`
	draft, err := parse(base, "action", true, sources)
	if err != nil || draft.Reviews[0].Complies != nil || draft.Expression.Mode != "inherit" || draft.Expression.Markdown != nil {
		t.Fatalf("未知或继承语义被改变: %+v %v", draft, err)
	}
	for _, body := range []string{
		strings.Replace(base, `"objective":"骑了六公里"`, `"objective":""`, 1),
		strings.Replace(base, `"reply":`, `"bypass":true,"reply":`, 1),
		base + `{}`,
	} {
		if _, err := parse(body, "action", true, sources); err == nil {
			t.Fatalf("无效模型响应被接受: %s", body)
		}
	}
	for name, body := range map[string]string{
		"missing review":   strings.Replace(base, `,"complies":null`, "", 1),
		"wrong source":     strings.Replace(base, `"one"`, `"other"`, 1),
		"false no reason":  strings.Replace(base, `"complies":null`, `"complies":false`, 1),
		"duplicate review": strings.Replace(base, `"reviews":[`, `"reviews":[{"sourceId":"one","complies":true},`, 1),
	} {
		draft, err := parse(body, "action", true, sources)
		if err != nil || len(draft.Reviews) != 1 || draft.Reviews[0].Complies != nil {
			t.Fatalf("%s 应降级为未知并交给独立核验: %+v %v", name, draft, err)
		}
	}
	legacyExpression := strings.Replace(base, `"reviews":[`, `"expression":{"mode":"inherit","markdown":""},"reviews":[`, 1)
	if draft, err := parse(legacyExpression, "action", true, sources); err != nil || draft.Expression.Mode != "inherit" {
		t.Fatalf("行动模式应忽略未使用的表达字段: %+v %v", draft, err)
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

func TestParseUsesFallbackReplyWhenActionDocumentIsComplete(t *testing.T) {
	content := `{"title":"切萨皮克湾海战","objective":"先堵住英国海军，再配合法军登陆推进。"}`
	draft, err := parse(content, "action", false, nil)
	if err != nil || draft.Title == "" || draft.Reply == "" {
		t.Fatalf("有完整行动文档但缺少 reply 时不应失败: %+v %v", draft, err)
	}
}

func TestParseAllowsOmittedReviewsWhenActionHasNoSources(t *testing.T) {
	content := `{"reply":"已记录这次行动","title":"解放波士顿","objective":"先攻下小城，再与美军合力击败英军，最后解放波士顿。"}`
	draft, err := parse(content, "action", false, nil)
	if err != nil || draft.Reply != "已记录这次行动" || draft.Title != "解放波士顿" || len(draft.Reviews) != 0 {
		t.Fatalf("没有来源时省略空核对列表应按空列表处理: %+v %v", draft, err)
	}
	withIrrelevantOutput := `{"reply":"已记录这次行动","title":"解放波士顿","objective":"先攻下小城，再解放波士顿。","expression":{"mode":"update","markdown":"多余输出"},"agreement":{"mode":"update","markdown":"多余输出"},"reviews":[{"sourceId":"old","complies":true}]}`
	draft, err = parse(withIrrelevantOutput, "action", false, nil)
	if err != nil || len(draft.Reviews) != 0 || draft.Expression.Mode != "clear" {
		t.Fatalf("行动模式应忽略未使用的表达与无来源核对输出: %+v %v", draft, err)
	}
}

func TestParseEnforcesActionContentLimit(t *testing.T) {
	atLimit := `{"reply":"已整理","title":"骑行","objective":"` + strings.Repeat("字", constants.ActionContentLimit) + `"}`
	if _, err := parse(atLimit, "action", false, nil); err != nil {
		t.Fatalf("达到上限的行动正文被拒绝: %v", err)
	}
	overLimit := `{"reply":"已整理","title":"骑行","objective":"` + strings.Repeat("字", constants.ActionContentLimit+1) + `"}`
	_, err := parse(overLimit, "action", false, nil)
	if err == nil || !strings.Contains(err.Error(), "2000") {
		t.Fatalf("超长行动正文未被拒绝或提示不明确: %v", err)
	}
}

func TestParseEnforcesActionTitleLimit(t *testing.T) {
	atLimit := `{"reply":"已整理","title":"` + strings.Repeat("字", constants.ActionTitleLimit) + `","objective":"骑了六公里。"}`
	if _, err := parse(atLimit, "action", false, nil); err != nil {
		t.Fatalf("达到上限的行动标题被拒绝: %v", err)
	}
	overLimit := `{"reply":"已整理","title":"` + strings.Repeat("字", constants.ActionTitleLimit+1) + `","objective":"骑了六公里。"}`
	_, err := parse(overLimit, "action", false, nil)
	if err == nil || !strings.Contains(err.Error(), "30") {
		t.Fatalf("超长行动标题未被拒绝或提示不明确: %v", err)
	}
}

func TestParseExplainsWhenActionHasNoDraft(t *testing.T) {
	content := `{"reply":"","title":"","objective":""}`
	_, err := parse(content, "action", false, nil)
	if err == nil || !strings.Contains(err.Error(), "还没有具体行动可整理") {
		t.Fatalf("没有行动草稿时返回了技术错误: %v", err)
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
	pending := Pending{Mode: "expression", NodeID: "current", InputMessages: []string{"调整看法"}}
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

func TestInitialNodeDocumentSnapshotMarksFirstGeneration(t *testing.T) {
	pending := Pending{Mode: "expression", Initial: true, Guide: "记录真实经历"}
	snapshot := snapshotFor(action.Graph{}, nil, nil, pending, true)
	if !snapshot.Initial {
		t.Fatal("首次节点文档没有标记 initial")
	}
	messages, err := prompt(snapshot, pending)
	if err != nil || len(messages) == 0 || !strings.Contains(messages[0].Content, `"initial":true`) {
		t.Fatalf("首次生成标记没有进入提示词: %v %v", messages, err)
	}
}

func TestSnapshotUsesAuthorDraftAsCurrentDocument(t *testing.T) {
	graph := action.Graph{Nodes: []action.Node{{ID: "node", Expression: action.Document{Markdown: "已发布表达"}, Agreement: action.Document{Markdown: "已发布约定"}}}}
	pending := Pending{Mode: "expression", NodeID: "node", CurrentDocument: "正在调整的表达草案"}
	snapshot := snapshotFor(graph, nil, nil, pending, false)
	if snapshot.CurrentExpression != "正在调整的表达草案" {
		t.Fatalf("草案没有作为当前表达: %q", snapshot.CurrentExpression)
	}
}

func TestActionSnapshotOmitsOwnSourceAgreement(t *testing.T) {
	graph := action.Graph{Nodes: []action.Node{{ID: "mine", AuthorID: "me", Expression: action.Document{Markdown: "我的表达"}, Agreement: action.Document{Markdown: "自己的约定"}}}}
	pending := Pending{Mode: "action", ActorID: "me", Sources: []action.GenerationSource{{NodeID: "mine"}}}
	snapshot := snapshotFor(graph, nil, nil, pending, true)
	if len(snapshot.Sources) != 0 {
		t.Fatalf("自己的来源不应进入约定上下文: %+v", snapshot.Sources)
	}
}
