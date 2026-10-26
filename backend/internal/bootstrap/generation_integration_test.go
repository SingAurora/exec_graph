package bootstrap

import (
	"strings"
	"testing"

	"github.com/singaurora/exec-graph/backend/internal/application/action"
	"github.com/singaurora/exec-graph/backend/internal/application/catalogue"
	app "github.com/singaurora/exec-graph/backend/internal/application/generation"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
)

func TestRealGenerationConfirmationAndPrivateInputs(t *testing.T) {
	provider := &recordedProvider{}
	s := writeFixtureDependencies(t, nil, provider)
	jo, lin := s.as(t, id.Demo("user", "jo")), s.as(t, id.Demo("user", "lin"))
	g := jo.graph(t)
	input := app.GenerateInput{Mode: "action", GraphID: g.ID, Message: "昨天戴着头盔骑了十二公里。", MergedParentIDs: []string{}, SourceVersions: []action.SourceVersion{}, Agreement: action.DocumentUpdate{Mode: "update", Markdown: str("骑行时佩戴头盔")}}
	key := id.New()
	generated := decode[app.View](t, jo.call(t, "POST", "ai/generate", input, 200, key))
	if generated.Status != "succeeded" || generated.Draft == nil || generated.CreateAction == nil || generated.ConversationID == "" {
		t.Fatalf("没有真实落库的生成结果: %+v", generated)
	}
	jo.call(t, "POST", "ai/generate", input, 200, key)
	if len(provider.requests) != 1 {
		t.Fatal("重复生成请求再次调用了模型")
	}
	input.Message = "不同输入"
	jo.call(t, "POST", "ai/generate", input, 409, key)
	lin.call(t, "GET", "ai/generation?generationId="+generated.GenerationID, nil, 404, "")
	root := jo.publish(t, *generated.CreateAction)
	if root.ObjectiveMarkdown != "实际完成了短途骑行。" || len(root.Conversation) != 2 {
		t.Fatalf("生成确认未保留实际事实和对话: %+v", root)
	}
	// 同一终点两位操作者先后生成，第二位不能看到第一位未确认的输入或回复。
	expression := app.GenerateInput{Mode: "expression", GraphID: g.ID, NodeID: root.ID, ExpectedVersion: root.Version, Message: "JO_PRIVATE_INPUT_781", MergedParentIDs: []string{}, SourceVersions: []action.SourceVersion{}, Agreement: action.DocumentUpdate{Mode: "inherit"}}
	private := decode[app.View](t, jo.call(t, "POST", "ai/generate", expression, 200, id.New()))
	expression.Message = "LIN_PRIVATE_INPUT_329"
	current := decode[app.View](t, lin.call(t, "POST", "ai/generate", expression, 200, id.New()))
	if strings.Contains(provider.lastPrompt(), "JO_PRIVATE_INPUT_781") {
		t.Fatal("其他用户私有输入泄露到了模型上下文")
	}
	updated := decode[catalogue.ActionView](t, lin.call(t, "POST", "expressions/update", *current.UpdateExpression, 200, ""))
	if len(updated.Conversation) != 2 {
		t.Fatal("后续整理改写了原始形成过程")
	}
	for _, message := range updated.ExpressionConversation {
		if strings.Contains(message.Body, "JO_PRIVATE_INPUT_781") {
			t.Fatal("他人未确认输入被公开")
		}
	}
	jo.call(t, "POST", "expressions/update", *private.UpdateExpression, 409, "")
	expression.Message, expression.ExpectedVersion = "JO_CONFIRMED_INPUT_994", updated.Version
	current = decode[app.View](t, jo.call(t, "POST", "ai/generate", expression, 200, id.New()))
	if !strings.Contains(provider.lastPrompt(), "LIN_PRIVATE_INPUT_329") {
		t.Fatal("已确认的后续形成过程没有进入上下文")
	}
	updated = decode[catalogue.ActionView](t, jo.call(t, "POST", "expressions/update", *current.UpdateExpression, 200, ""))
	// 从当前版本承接，服务端保存引用快照，未知约定仍然允许确认发布。
	input.Message, input.ParentID = "今天又骑行了六公里。", root.ID
	input.SourceVersions = []action.SourceVersion{{NodeID: root.ID, Version: updated.Version}}
	input.Agreement = action.DocumentUpdate{Mode: "inherit"}
	child := decode[app.View](t, jo.call(t, "POST", "ai/generate", input, 200, id.New()))
	if child.Draft.Reviews[0].Complies != nil {
		t.Fatal("未核对约定被默认为满足")
	}
	created := jo.publish(t, *child.CreateAction)
	if created.ParentID != root.ID || created.Number != 2 {
		t.Fatal("真实生成后承接发布失败")
	}
	provider.fail = true
	input.ParentID, input.SourceVersions = created.ID, []action.SourceVersion{{NodeID: created.ID, Version: created.Version}}
	failureKey := id.New()
	jo.call(t, "POST", "ai/generate", input, 503, failureKey)
	failed := decode[app.View](t, jo.call(t, "POST", "ai/generate", input, 200, failureKey))
	if failed.Status != "failed" {
		t.Fatal("失败生成没有结束 pending")
	}
	provider.fail = false
	jo.call(t, "POST", "ai/generate", input, 200, id.New())
}
