package bootstrap

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"

	"github.com/singaurora/exec-graph/backend/internal/application/action"
	app "github.com/singaurora/exec-graph/backend/internal/application/generation"
)

type recordedProvider struct {
	mu       sync.Mutex
	requests [][]app.Message
	fail     bool
}

func (p *recordedProvider) Model() string { return "integration-provider" }
func (p *recordedProvider) Complete(ctx context.Context, messages []app.Message) (app.Completion, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.requests = append(p.requests, append([]app.Message{}, messages...))
	if p.fail {
		return app.Completion{}, fmt.Errorf("测试上游失败")
	}
	var snapshot struct {
		Mode    string `json:"mode"`
		Sources []struct {
			NodeID string `json:"nodeId"`
		} `json:"sources"`
	}
	prefix := "当前服务端快照："
	parts := strings.SplitN(messages[0].Content, prefix, 2)
	if len(parts) != 2 {
		return app.Completion{}, fmt.Errorf("服务端提示缺少快照")
	}
	if err := json.Unmarshal([]byte(parts[1]), &snapshot); err != nil {
		return app.Completion{}, err
	}
	reviews := []action.SourceAssessment{}
	for _, source := range snapshot.Sources {
		reviews = append(reviews, action.SourceAssessment{SourceID: source.NodeID, Provided: true})
	}
	draft := struct {
		Reply      string `json:"reply"`
		Title      string `json:"title"`
		Objective  string `json:"objective"`
		Expression struct {
			Mode     string `json:"mode"`
			Markdown string `json:"markdown"`
		} `json:"expression"`
		Reviews []action.SourceAssessment `json:"reviews"`
	}{Reply: "已整理你的实际输入", Title: "已经发生的骑行", Objective: "实际完成了短途骑行。", Reviews: reviews}
	draft.Expression.Mode, draft.Expression.Markdown = "update", "由当前输入形成的表达："+messages[len(messages)-1].Content
	if snapshot.Mode == "expression" {
		draft.Title, draft.Objective = "", ""
	}
	body, err := json.Marshal(draft)
	return app.Completion{Content: string(body), InputTokens: 100, OutputTokens: 80}, err
}

func (p *recordedProvider) lastPrompt() string {
	p.mu.Lock()
	defer p.mu.Unlock()
	encoded, _ := json.Marshal(p.requests[len(p.requests)-1])
	return string(encoded)
}
