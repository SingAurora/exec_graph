package bootstrap

import (
	"context"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/singaurora/exec-graph/backend/internal/application/action"
	"github.com/singaurora/exec-graph/backend/internal/application/catalogue"
	app "github.com/singaurora/exec-graph/backend/internal/application/generation"
	"github.com/singaurora/exec-graph/backend/internal/bootstrap/config"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/ai"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
)

func TestRealPlatformAIAndPublication(t *testing.T) {
	if os.Getenv("EXEC_GRAPH_AI_INTEGRATION") != "1" || os.Getenv("EXEC_GRAPH_INTEGRATION") != "1" {
		t.Skip("同时显式启用平台模型与数据库验证")
	}
	c, err := config.Load(config.Path())
	if err != nil {
		t.Fatal(err)
	}
	provider, err := ai.New(c.AI)
	if err != nil {
		t.Fatal(err)
	}
	if provider.Model() == "" {
		t.Fatal("未配置平台模型密钥，不能声称真实 AI 验收通过")
	}
	observed := &cloudRecordingProvider{provider: provider}
	t.Cleanup(func() {
		if t.Failed() {
			for i, result := range observed.results {
				t.Logf("测试模型第 %d 轮耗时 %s，错误 %v，测试响应：%s", i+1, result.elapsed, result.err, result.completion.Content)
			}
		}
	})
	s := writeFixtureDependencies(t, nil, observed)
	jo := s.as(t, id.Demo("user", "jo"))
	g := jo.graph(t)
	input := app.GenerateInput{Mode: "action", GraphID: g.ID, Message: "我今天骑自行车通勤十二公里，用了四十分钟。我发现提前十分钟出门可以避开拥堵，想继续保持。只记录这些事实和观点。", MergedParentIDs: []string{}, SourceVersions: []action.SourceVersion{}, Agreement: action.DocumentUpdate{Mode: "clear"}}
	generated := decode[app.View](t, jo.call(t, "POST", "ai/generate", input, 200, id.New()))
	if generated.CreateAction == nil || generated.Draft == nil {
		t.Fatal("真实模型没有生成可确认结果")
	}
	node := jo.publish(t, *generated.CreateAction)
	if node.Title == "" || node.ObjectiveMarkdown == "" || len(node.Conversation) != 2 {
		t.Fatal("真实生成未确认到行动与形成过程")
	}
	if strings.Contains(node.ObjectiveMarkdown, "想继续保持") || strings.Contains(node.ObjectiveMarkdown, "可以避开拥堵") {
		t.Fatal("意愿或缺少行动依据的概括混入了行动正文")
	}
	agreement := "记录本次骑行距离。记录本次骑行用时。"
	node = decode[catalogue.ActionView](t, jo.call(t, "POST", "agreements/update", action.UpdateAgreementInput{NodeID: node.ID, ExpectedVersion: node.Version, Document: action.DocumentUpdate{Mode: "update", Markdown: &agreement}}, 200, ""))
	for _, test := range []struct {
		name, report string
		want         *bool
	}{
		{"missing time is unknown", "我今天骑了6公里。只记录这次行动，不增加表达。", nil},
		{"explicitly unrecorded time is false", "我今天骑了6公里，没有记录用时。只记录这次行动，不增加表达。", cloudBool(false)},
		{"distance and time satisfy all clauses", "我今天骑了6公里，用时20分钟。只记录这次行动，不增加表达。", cloudBool(true)},
	} {
		t.Run(test.name, func(t *testing.T) {
			input := app.GenerateInput{Mode: "action", GraphID: g.ID, ParentID: node.ID, SourceVersions: []action.SourceVersion{{NodeID: node.ID, Version: node.Version}}, MergedParentIDs: []string{}, Message: test.report, Agreement: action.DocumentUpdate{Mode: "inherit"}}
			view := decode[app.View](t, jo.call(t, "POST", "ai/generate", input, 200, id.New()))
			if view.Draft == nil || len(view.Draft.Reviews) != 1 {
				t.Fatalf("缺少来源核验: %+v", view)
			}
			got := view.Draft.Reviews[0].Complies
			if (got == nil) != (test.want == nil) || (got != nil && *got != *test.want) {
				t.Fatalf("真实约定核验错误: %+v", view.Draft.Reviews[0])
			}
		})
	}
	t.Logf("平台模型 %s：生成、服务端确认、持久化读取通过", provider.Model())
}

func cloudBool(value bool) *bool { return &value }

type cloudCall struct {
	completion app.Completion
	err        error
	elapsed    time.Duration
}

type cloudRecordingProvider struct {
	provider app.Provider
	results  []cloudCall
}

func (p *cloudRecordingProvider) Model() string { return p.provider.Model() }
func (p *cloudRecordingProvider) Complete(ctx context.Context, messages []app.Message) (app.Completion, error) {
	start := time.Now()
	out, err := p.provider.Complete(ctx, messages)
	p.results = append(p.results, cloudCall{out, err, time.Since(start)})
	return out, err
}
