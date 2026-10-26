package bootstrap

import (
	"os"
	"testing"

	"github.com/singaurora/exec-graph/backend/internal/application/action"
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
	s := writeFixtureDependencies(t, nil, provider)
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
	t.Logf("平台模型 %s：生成、服务端确认、持久化读取通过", provider.Model())
}
