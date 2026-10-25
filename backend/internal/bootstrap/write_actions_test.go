package bootstrap

import (
	"bytes"
	"fmt"
	"testing"

	app "github.com/singaurora/exec-graph/backend/internal/application/action"
	"github.com/singaurora/exec-graph/backend/internal/application/catalogue"
	"github.com/singaurora/exec-graph/backend/internal/application/graph"
	"github.com/singaurora/exec-graph/backend/internal/application/identity"
	"github.com/singaurora/exec-graph/backend/internal/application/profile"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
	"gorm.io/gorm"
)

func TestRealActionPublicationAndDocuments(t *testing.T) {
	s := writeFixture(t)
	joID, linID := id.Demo("user", "jo"), id.Demo("user", "lin")
	jo, lin := s.as(t, joID), s.as(t, linID)
	clear, inherit := app.DocumentUpdate{Mode: "clear"}, app.DocumentUpdate{Mode: "inherit"}
	expression := app.DocumentUpdate{Mode: "update", Markdown: str("我完成了可复用的第一次实践。")}
	agreement := app.DocumentUpdate{Mode: "update", Markdown: str("回应时说明你实际采用的条件。")}
	g := jo.graph(t)
	draft := s.draft(t, joID, g.ID, "", nil, expression, agreement)
	lin.call(t, "POST", "actions/create", draft, 403, id.New())
	key := id.New()
	first := jo.call(t, "POST", "actions/create", draft, 200, key)
	a := decode[catalogue.ActionView](t, first)
	if a.Number != 1 || a.AuthorID != joID || len(a.Conversation) != 2 || a.AgreementMarkdown == nil || *a.AgreementMarkdown != *agreement.Markdown {
		t.Fatal("首次行动或形成过程错误")
	}
	if replay := jo.call(t, "POST", "actions/create", draft, 200, key); !bytes.Equal(first, replay) {
		t.Fatal("发布没有重放同一行动")
	}
	jo.call(t, "POST", "actions/create", draft, 409, id.New())
	jo.call(t, "POST", "actions/create", struct {
		GraphID string `json:"graphId"`
		Title   string `json:"title"`
	}{g.ID, "伪造客户端文稿"}, 400, id.New())
	otherRoot := s.draft(t, joID, g.ID, "", nil, clear, clear)
	jo.call(t, "POST", "actions/create", otherRoot, 409, id.New())
	// 终点可由其他登录用户整理；行动者和最初事实不能因此改变。
	changed := app.DocumentUpdate{Mode: "update", Markdown: str("请说明条件，也说明没有满足的部分。")}
	a = decode[catalogue.ActionView](t, lin.call(t, "POST", "agreements/update", app.UpdateAgreementInput{NodeID: a.ID, ExpectedVersion: 1, Document: changed}, 200, ""))
	if a.AuthorID != joID || a.Version != 2 || a.AgreementSupplement == nil || a.AgreementSupplement.AuthorID != linID {
		t.Fatal("约定整理覆盖行动者或丢失操作者")
	}
	jo.call(t, "POST", "agreements/update", app.UpdateAgreementInput{NodeID: a.ID, ExpectedVersion: 1, Document: clear}, 409, "")
	jo.call(t, "POST", "agreements/update", app.UpdateAgreementInput{NodeID: a.ID, ExpectedVersion: 2, Document: inherit}, 400, "")
	jo.call(t, "POST", "agreements/update", app.UpdateAgreementInput{NodeID: a.ID, ExpectedVersion: 2, Document: changed}, 409, "")

	bDraft := s.draft(t, joID, g.ID, "", []string{a.ID}, inherit, clear)
	negative, reason := false, "本次更换了条件，只提供有限范围的实际结果。"
	bDraft.ReferenceAgreements[0].Complies, bDraft.ReferenceAgreements[0].ExceptionReason = &negative, &reason
	zero := uint8(0)
	mustDB(t, s.deps.DB.Model(&model.GenerationSource{}).Where("generation_uuid = ?", bDraft.GenerationID).Updates(model.GenerationSource{Complies: &zero, ExceptionReason: &reason}))
	b := jo.publish(t, bDraft)
	if b.ExpressionMarkdown != nil || b.AgreementMarkdown == nil || *b.AgreementMarkdown != "" || len(b.ReferenceAgreements) != 1 || b.ReferenceAgreements[0].Complies == nil || *b.ReferenceAgreements[0].Complies {
		t.Fatal("继承、清空或不满足约定语义丢失")
	}
	jo.call(t, "POST", "agreements/update", app.UpdateAgreementInput{NodeID: a.ID, ExpectedVersion: 2, Document: clear}, 409, "")
	c := jo.publish(t, s.draft(t, joID, g.ID, "", []string{a.ID}, inherit, inherit))
	merged := s.draft(t, joID, g.ID, "", []string{c.ID, b.ID}, inherit, inherit)
	d := jo.publish(t, merged)
	if d.Number != 4 || d.ContextSnapshot.HistoryNodeCount != 3 || d.ParentID != c.ID || len(d.MergedParentIDs) != 1 || d.MergedParentIDs[0] != b.ID {
		t.Fatal("合入历史并集、编号或主要来源错误")
	}
	var drow model.ActionNode
	mustDB(t, s.deps.DB.Where("uuid = ?", d.ID).Take(&drow))
	if drow.NodeLevel != 3 {
		t.Fatal("节点深度误当作编号")
	}
	var states []model.DocumentState
	mustDB(t, s.deps.DB.Where("node_uuid IN ? AND kind = ?", []string{a.ID, d.ID}, "agreement").Find(&states))
	if len(states) != 2 || states[0].EffectiveVersionUUID == nil || states[1].EffectiveVersionUUID == nil || *states[0].EffectiveVersionUUID != *states[1].EffectiveVersionUUID {
		t.Fatal("合入分支的清空约定污染了主要链继承")
	}
	jo.call(t, "POST", "agreements/update", app.UpdateAgreementInput{NodeID: b.ID, ExpectedVersion: 1, Document: agreement}, 409, "")
	badMerge := s.draft(t, joID, g.ID, "", []string{d.ID, a.ID}, inherit, inherit)
	jo.call(t, "POST", "actions/create", badMerge, 409, id.New())
	outside := jo.graph(t)
	cross := s.draft(t, joID, outside.ID, "", []string{a.ID}, inherit, inherit)
	jo.call(t, "POST", "actions/create", cross, 409, id.New())
	stale := s.draft(t, joID, g.ID, "", []string{d.ID}, inherit, inherit)
	jo.call(t, "POST", "agreements/update", app.UpdateAgreementInput{NodeID: d.ID, ExpectedVersion: 1, Document: clear}, 200, "")
	jo.call(t, "POST", "actions/create", stale, 409, id.New())
	// 来源已改变，失败不能占用编号或把生成提前确认。
	assertUnpublished(t, s, stale.GenerationID, g.ID, 5)
	count := uint32(4)
	jo.call(t, "POST", "graphs/delete", graph.DeleteGraphInput{GraphID: g.ID, ExpectedVersion: 1, ExpectedNodeCount: &count}, 200, "")
	jo.call(t, "GET", "actions/detail?nodeId="+a.ID, nil, 404, "")
}

func TestRealExpressionHighlightsAndAtomicRollback(t *testing.T) {
	s := writeFixture(t)
	joID, linID := id.Demo("user", "jo"), id.Demo("user", "lin")
	jo, lin := s.as(t, joID), s.as(t, linID)
	clear, inherit := app.DocumentUpdate{Mode: "clear"}, app.DocumentUpdate{Mode: "inherit"}
	expression := app.DocumentUpdate{Mode: "update", Markdown: str("我用实际行动说明一个兴趣。")}
	g := jo.graph(t)
	a := jo.publish(t, s.draft(t, joID, g.ID, "", nil, expression, clear))
	account := decode[identity.SessionView](t, jo.call(t, "GET", "auth/session", nil, 200, ""))
	jo.call(t, "POST", "profiles/highlights-set", profile.SetHighlightsInput{ExpectedVersion: account.User.Version, ExpressionNodeIDs: []string{a.ID}}, 200, "")
	editExpression := app.DocumentUpdate{Mode: "update", Markdown: str("这是林实际整理并确认的表达。")}
	edit := s.draft(t, linID, g.ID, a.ID, nil, editExpression, clear)
	jo.call(t, "POST", "expressions/update", app.UpdateExpressionInput{NodeID: a.ID, ExpectedVersion: 1, GenerationID: edit.GenerationID}, 403, "")
	next := decode[catalogue.ActionView](t, lin.call(t, "POST", "expressions/update", app.UpdateExpressionInput{NodeID: a.ID, ExpectedVersion: 1, GenerationID: edit.GenerationID}, 200, ""))
	if next.ObjectiveMarkdown != a.ObjectiveMarkdown || next.AuthorID != joID || len(next.Conversation) != len(a.Conversation) || len(next.ExpressionConversation) != 2 || next.ExpressionConversation[0].AuthorID != linID || next.ExpressionSupplement == nil || next.ExpressionSupplement.AuthorID != linID {
		t.Fatal("表达修改覆盖原始事实、对话或整理者")
	}
	account = decode[identity.SessionView](t, jo.call(t, "GET", "auth/session", nil, 200, ""))
	if len(account.User.Highlights.ExpressionNodeIDs) != 0 {
		t.Fatal("已非本人表达仍显示在本人精选")
	}
	jo.call(t, "POST", "profiles/highlights-set", profile.SetHighlightsInput{ExpectedVersion: account.User.Version, ExpressionNodeIDs: []string{a.ID}}, 403, "")
	linAccount := decode[identity.SessionView](t, lin.call(t, "GET", "auth/session", nil, 200, ""))
	lin.call(t, "POST", "profiles/highlights-set", profile.SetHighlightsInput{ExpectedVersion: linAccount.User.Version, ExpressionNodeIDs: []string{a.ID}}, 200, "")
	childDraft := s.draft(t, linID, g.ID, "", []string{a.ID}, inherit, inherit)
	key := id.New()
	// 在节点已写入之后注入引用写入失败，实际验证数据库事务回滚，而非仅在参数阶段拒绝。
	const callback = "integration:fail-reference"
	if err := s.deps.DB.Callback().Create().Before("gorm:create").Register(callback, func(db *gorm.DB) {
		if db.Statement.Table == "action_references" {
			db.AddError(fmt.Errorf("集成测试注入的引用存储失败"))
		}
	}); err != nil {
		t.Fatal(err)
	}
	lin.call(t, "POST", "actions/create", childDraft, 500, key)
	if err := s.deps.DB.Callback().Create().Remove(callback); err != nil {
		t.Fatal(err)
	}
	assertUnpublished(t, s, childDraft.GenerationID, g.ID, 2)
	var receipts int64
	mustDB(t, s.deps.DB.Model(&model.IdempotencyRecord{}).Where("request_key = ?", key).Count(&receipts))
	if receipts != 0 {
		t.Fatal("失败事务留下了成功回执")
	}
	b := decode[catalogue.ActionView](t, lin.call(t, "POST", "actions/create", childDraft, 200, key))
	if b.Number != 2 {
		t.Fatal("回滚后编号出现空洞")
	}
	// 新后续行动不自动替换用户选中的具体节点。
	linAccount = decode[identity.SessionView](t, lin.call(t, "GET", "auth/session", nil, 200, ""))
	if len(linAccount.User.Highlights.ExpressionNodeIDs) != 1 || linAccount.User.Highlights.ExpressionNodeIDs[0] != a.ID {
		t.Fatal("精选自动移动到了后续节点")
	}
	count := uint32(2)
	jo.call(t, "POST", "graphs/delete", graph.DeleteGraphInput{GraphID: g.ID, ExpectedVersion: 1, ExpectedNodeCount: &count}, 403, "")
	// 林已贡献行动，具备前三贡献者的图资料编辑资格。
	avatar := id.Demo("asset", "demo-cycling.jpg")
	jo.call(t, "POST", "graphs/update", graph.UpdateGraphInput{GraphID: g.ID, ExpectedVersion: 1, Title: g.Title, Description: "", AvatarAssetID: &avatar}, 200, "")
	retained := decode[catalogue.GraphView](t, lin.call(t, "POST", "graphs/update", graph.UpdateGraphInput{GraphID: g.ID, ExpectedVersion: 2, Title: "林整理后的图", Description: "", AvatarAssetID: &avatar}, 200, ""))
	if retained.Avatar == nil {
		t.Fatal("资料编辑者应能保留图原有图片，不需要重新拥有它")
	}
	clearEdit := s.draft(t, linID, g.ID, b.ID, nil, clear, clear)
	lin.call(t, "POST", "expressions/update", app.UpdateExpressionInput{NodeID: b.ID, ExpectedVersion: 1, GenerationID: clearEdit.GenerationID}, 200, "")
	linAccount = decode[identity.SessionView](t, lin.call(t, "GET", "auth/session", nil, 200, ""))
	lin.call(t, "POST", "profiles/highlights-set", profile.SetHighlightsInput{ExpectedVersion: linAccount.User.Version, ExpressionNodeIDs: []string{b.ID}}, 400, "")
}

func assertUnpublished(t *testing.T, s *writeSystem, generationID, graphID string, nextNumber uint32) {
	t.Helper()
	var generation model.AIGeneration
	mustDB(t, s.deps.DB.Where("uuid = ?", generationID).Take(&generation))
	var graph model.Graph
	mustDB(t, s.deps.DB.Where("uuid = ?", graphID).Take(&graph))
	var conversation model.AIConversation
	mustDB(t, s.deps.DB.Where("uuid = ?", generation.ConversationUUID).Take(&conversation))
	if generation.ConfirmedAt != nil || conversation.NodeUUID != nil || graph.NextNodeNumber != nextNumber {
		t.Fatal("失败发布残留了确认、节点绑定或编号变化")
	}
}
