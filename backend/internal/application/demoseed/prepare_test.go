package demoseed

import (
	"github.com/singaurora/exec-graph/backend/internal/application/catalogue"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
	"testing"
	"time"
)

type testPasswords struct{}

func (testPasswords) Hash(string) (string, error) { return "test-only-hash", nil }
func (testPasswords) Token() string               { return "test-only-password" }
func text(value string) *string                   { return &value }

func example() Dataset {
	conversation := []catalogue.Message{{ID: "user", Speaker: "user", Body: "真实行动"}, {ID: "ai", Speaker: "ai", Body: "整理结果"}}
	return Dataset{Dataset: "frontend-demo-v1", Users: []User{{ProfileView: catalogue.ProfileView{ID: "jo", Name: "乔", Gender: "unknown", Highlights: catalogue.Highlights{ExpressionNodeIDs: []string{"c"}}}, Email: "qiao@example.com"}}, Graphs: []catalogue.GraphView{{ID: "graph", OwnerID: "jo", Title: "图", CreatedAt: time.Now(), UpdatedAt: time.Now()}}, Actions: []catalogue.ActionView{
		{ID: "a", GraphID: "graph", Number: 1, AuthorID: "jo", Title: "起点", ObjectiveMarkdown: "已发生的事", ExpressionMarkdown: text("E1"), AgreementMarkdown: text("G1"), Conversation: conversation},
		{ID: "b", GraphID: "graph", Number: 2, ParentID: "a", AuthorID: "jo", Title: "清空后续约定", ObjectiveMarkdown: "第二次行动", AgreementMarkdown: text(""), Conversation: conversation},
		{ID: "c", GraphID: "graph", Number: 3, ParentID: "b", AuthorID: "jo", Title: "继承清空", ObjectiveMarkdown: "第三次行动", Conversation: conversation},
	}}
}

func TestImportPreservesClearInheritanceAndUnknownAssessment(t *testing.T) {
	source := example()
	out, err := Prepare(source, "digest", "", testPasswords{})
	if err != nil {
		t.Fatal(err)
	}
	a, b, c := out.Nodes[0], out.Nodes[1], out.Nodes[2]
	if a.LocalExpressionUUID == nil || c.EffectiveExpressionUUID == nil || *c.EffectiveExpressionUUID != *a.LocalExpressionUUID {
		t.Fatal("表达未沿主要来源继承")
	}
	if b.LocalAgreementUUID == nil || c.EffectiveAgreementUUID == nil || *c.EffectiveAgreementUUID != *b.LocalAgreementUUID {
		t.Fatal("清空被跳过并错误继承祖先约定")
	}
	if b.View.AgreementMarkdown == nil || *b.View.AgreementMarkdown != "" || c.View.AgreementMarkdown != nil {
		t.Fatal("明确清空和继承没有区分")
	}
	if out.References[0].Status != "unreviewed" || out.References[1].Status != "unrestricted" {
		t.Fatal("未核对被伪造为满足，或清空未生效")
	}
	if c.View.ContextSnapshot.HistoryNodeCount != 2 || c.Level != 3 {
		t.Fatal("引用背景或层级计算错误")
	}
	if source.Actions[1].ParentID != "a" || source.Actions[0].Conversation[0].ID != "user" || source.Users[0].Highlights.ExpressionNodeIDs[0] != "c" {
		t.Fatal("转换修改了源夹具")
	}
	again, err := Prepare(source, "digest", "", testPasswords{})
	if err != nil {
		t.Fatal(err)
	}
	if out.Nodes[0].View.ID != again.Nodes[0].View.ID || !id.Valid(out.Nodes[0].View.ID) {
		t.Fatal("重复准备不能保持稳定 UUID")
	}
}

func TestImportRejectsCrossGraphAndUnexplainedException(t *testing.T) {
	source := example()
	source.Graphs = append(source.Graphs, catalogue.GraphView{ID: "another", OwnerID: "jo", Title: "另一图"})
	source.Actions[1].GraphID = "another"
	if _, err := Prepare(source, "digest", "", testPasswords{}); err == nil {
		t.Fatal("跨图来源未被拒绝")
	}
	source = example()
	no := false
	source.Actions[1].ReferenceAgreements = []catalogue.Assessment{{SourceID: "a", Complies: &no}}
	if _, err := Prepare(source, "digest", "", testPasswords{}); err == nil {
		t.Fatal("不满足约定但没有原因未被拒绝")
	}
}
