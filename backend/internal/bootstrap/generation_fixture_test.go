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
	mu               sync.Mutex
	requests         [][]app.Message
	fail             bool
	reject           bool
	failVerification bool
}

func (p *recordedProvider) Model() string { return "integration-provider" }
func (p *recordedProvider) Complete(ctx context.Context, messages []app.Message) (app.Completion, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.requests = append(p.requests, append([]app.Message{}, messages...))
	if p.fail {
		return app.Completion{}, fmt.Errorf("测试上游失败")
	}
	if len(messages) == 2 && strings.HasPrefix(messages[0].Content, "你是引序平台的对话路由器") {
		return app.Completion{Content: `{"tool":"verify_draft"}`, InputTokens: 10, OutputTokens: 5}, nil
	}
	if len(messages) == 2 && strings.HasPrefix(messages[1].Content, `{"context":`) {
		if p.failVerification {
			return app.Completion{}, fmt.Errorf("测试核验上游失败")
		}
		return p.verification(messages[1].Content)
	}
	var snapshot struct {
		Mode    string `json:"mode"`
		Sources []struct {
			NodeID string `json:"nodeUuid"`
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
	for i := len(p.requests) - 1; i >= 0; i-- {
		if strings.Contains(p.requests[i][0].Content, "当前服务端快照：") {
			encoded, _ := json.Marshal(p.requests[i])
			return string(encoded)
		}
	}
	return ""
}

type fixtureEvidence struct {
	Kind  string `json:"kind"`
	ID    string `json:"id"`
	Quote string `json:"quote"`
}

type fixtureDocumentCheck struct {
	Valid    bool              `json:"valid"`
	Evidence []fixtureEvidence `json:"evidence"`
}

type fixtureCondition struct {
	Text     string            `json:"text"`
	Complies *bool             `json:"complies"`
	Evidence []fixtureEvidence `json:"evidence"`
}

type fixtureAgreementCheck struct {
	SourceID   string             `json:"sourceUuid"`
	Conditions []fixtureCondition `json:"conditions"`
}

func (p *recordedProvider) verification(input string) (app.Completion, error) {
	var in struct {
		Context struct {
			Mode    string `json:"mode"`
			Reports []struct {
				ID   string `json:"id"`
				Text string `json:"text"`
			} `json:"reports"`
			Facts []struct {
				NodeID    string `json:"nodeUuid"`
				Objective string `json:"objective"`
			} `json:"facts"`
			Sources []struct {
				NodeID    string `json:"nodeUuid"`
				Agreement string `json:"agreement"`
			} `json:"sources"`
		} `json:"context"`
		Draft app.Draft `json:"draft"`
	}
	if err := json.Unmarshal([]byte(input), &in); err != nil {
		return app.Completion{}, err
	}
	result := struct {
		Action     fixtureDocumentCheck    `json:"action"`
		Expression fixtureDocumentCheck    `json:"expression"`
		Reviews    []fixtureAgreementCheck `json:"reviews"`
	}{Action: fixtureDocumentCheck{!p.reject, []fixtureEvidence{}}, Expression: fixtureDocumentCheck{true, []fixtureEvidence{}}, Reviews: []fixtureAgreementCheck{}}
	item := fixtureEvidence{}
	if in.Context.Mode == "action" {
		result.Action.Evidence = []fixtureEvidence{}
		for _, report := range in.Context.Reports {
			item = fixtureEvidence{"report", report.ID, report.Text}
			result.Action.Evidence = append(result.Action.Evidence, item)
		}
	} else if len(in.Context.Facts) > 0 {
		f := in.Context.Facts[0]
		item = fixtureEvidence{"action", f.NodeID, f.Objective}
	}
	if in.Draft.Expression.Mode == "update" {
		result.Expression.Evidence = []fixtureEvidence{item}
	}
	for _, source := range in.Context.Sources {
		check := fixtureAgreementCheck{source.NodeID, []fixtureCondition{}}
		if source.Agreement != "" {
			check.Conditions = append(check.Conditions, fixtureCondition{source.Agreement, nil, []fixtureEvidence{}})
		}
		result.Reviews = append(result.Reviews, check)
	}
	body, err := json.Marshal(result)
	return app.Completion{Content: string(body), InputTokens: 60, OutputTokens: 40}, err
}
