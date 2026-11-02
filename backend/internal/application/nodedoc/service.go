// Package nodedoc 为已发布的行动节点生成独立的表达和约定草案。
package nodedoc

import (
	"context"
	"encoding/json"
	"io"
	"sort"
	"strings"
	"unicode/utf8"

	actionapp "github.com/singaurora/exec-graph/backend/internal/application/action"
	generationapp "github.com/singaurora/exec-graph/backend/internal/application/generation"
	"github.com/singaurora/exec-graph/backend/internal/application/identity"
	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
)

// Service 生成节点文档；它不修改行动事实。
type Service struct {
	store    actionapp.Store
	provider generationapp.Provider
}

// New 注入行动事务仓储和文本模型。
func New(store actionapp.Store, provider generationapp.Provider) *Service {
	return &Service{store: store, provider: provider}
}

const rules = `你是引序平台的节点文档助手。只返回 JSON，不要代码块，不要解释。
输入是一个已经发布的行动节点及其分支事实。请为该节点生成两份属于它自己的文档，不能继承、复制或沿用任何父节点文档：
1. expression：这条分支到目前为止的总体概括。只能基于 facts 中已发生的行动和当前行动；不要新增未报告的事实，不要写成行动流水账，不要评价尚未发生的结果。200 到 600 字。
2. agreement：未来什么样的行动会引起作者兴趣，是面向后续行动的判断条件，不是对本次行动的总结。给 1 到 5 条具体、可理解、可判断的条件；不要替作者增加未表达的条件，不要写成空泛的“有意义/有价值”。每条之间换行。
返回 {"expression":"...","agreement":"..."}。两个字段都必须非空，正文不超过 2000 字。`

type promptInput struct {
	ActorID    string         `json:"actorId"`
	Guide      string         `json:"guide,omitempty"`
	Action     promptAction   `json:"action"`
	Facts      []promptFact   `json:"facts"`
	SourceDocs []promptSource `json:"sourceDocuments"`
}

type promptAction struct {
	Title     string `json:"title"`
	Objective string `json:"objective"`
}

type promptFact struct {
	NodeID    string `json:"nodeId"`
	Number    uint32 `json:"number"`
	AuthorID  string `json:"authorId"`
	Title     string `json:"title"`
	Objective string `json:"objective"`
}

type promptSource struct {
	NodeID     string `json:"nodeId"`
	Expression string `json:"expression"`
	Agreement  string `json:"agreement"`
}

type output struct {
	Expression string `json:"expression"`
	Agreement  string `json:"agreement"`
	Reply      string `json:"reply"`
}

// Generate 生成并保存表达/约定草案；失败时把两个文档标记为 failed，等待重试。
func (s *Service) Generate(ctx context.Context, actor identity.Actor, nodeID string) ([]actionapp.NodeDocument, error) {
	if !id.Valid(nodeID) {
		return nil, fault.New(fault.Invalid, "节点不合法")
	}
	if s.provider == nil || s.provider.Model() == "" {
		return nil, fault.New(fault.Unavailable, "平台 AI 暂未启用")
	}
	var input promptInput
	var version uint32
	err := s.store.Within(ctx, actor, func(tx actionapp.Transaction) error {
		graphID, err := tx.NodeGraph(nodeID)
		if err != nil {
			return err
		}
		graph, err := tx.Graph(graphID)
		if err != nil {
			return err
		}
		node, err := findNode(graph, nodeID)
		if err != nil {
			return err
		}
		if !terminal(graph, nodeID) {
			return fault.New(fault.Conflict, "节点已被接续，不能修改表达或约定")
		}
		version = node.Version
		var parents []string
		for _, edge := range graph.Edges {
			if edge.TargetID == nodeID {
				parents = append(parents, edge.SourceID)
			}
		}
		byID := map[string]actionapp.Node{}
		for _, item := range graph.Nodes {
			byID[item.ID] = item
		}
		history := actionapp.HistoryNodeIDs(graph, parents)
		facts := make([]promptFact, 0, len(history))
		for id := range history {
			item, ok := byID[id]
			if !ok {
				continue
			}
			facts = append(facts, promptFact{NodeID: item.ID, Number: item.Number, AuthorID: item.AuthorID, Title: item.Title, Objective: item.Objective})
		}
		sort.Slice(facts, func(i, j int) bool { return facts[i].Number < facts[j].Number })
		input = promptInput{ActorID: actor.UserID, Guide: graph.Guide, Action: promptAction{Title: node.Title, Objective: node.Objective}, Facts: facts}
		for _, parent := range parents {
			item, ok := byID[parent]
			if !ok {
				continue
			}
			input.SourceDocs = append(input.SourceDocs, promptSource{NodeID: item.ID, Expression: item.Expression.Markdown, Agreement: item.Agreement.Markdown})
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	_ = version
	encoded, err := json.Marshal(input)
	if err != nil {
		return nil, err
	}
	modelCtx, cancel := context.WithTimeout(ctx, constants.AITimeout)
	defer cancel()
	completion, err := s.provider.Complete(modelCtx, []generationapp.Message{{Role: "system", Content: rules}, {Role: "user", Content: string(encoded)}})
	if err != nil {
		_ = s.fail(ctx, actor, nodeID, "provider_failed", "AI 生成失败，请稍后重试")
		return nil, fault.New(fault.Unavailable, "AI 生成失败，请稍后重试")
	}
	parsed, err := parse(completion.Content)
	if err != nil {
		_ = s.fail(ctx, actor, nodeID, "invalid_output", "AI 返回的文档不完整，请重试")
		return nil, err
	}
	documents := []actionapp.NodeDocument{
		{Kind: "expression", Status: "draft", DraftMarkdown: parsed.Expression},
		{Kind: "agreement", Status: "draft", DraftMarkdown: parsed.Agreement},
	}
	err = s.store.Within(ctx, actor, func(tx actionapp.Transaction) error {
		graphID, err := tx.NodeGraph(nodeID)
		if err != nil {
			return err
		}
		graph, err := tx.Graph(graphID)
		if err != nil {
			return err
		}
		node, err := findNode(graph, nodeID)
		if err != nil {
			return err
		}
		if node.Version != version || !terminal(graph, nodeID) {
			return fault.New(fault.Conflict, "节点已变化或被接续，请重新生成")
		}
		return tx.SaveNodeDocuments(nodeID, documents)
	})
	if err != nil {
		return nil, err
	}
	return documents, nil
}

func (s *Service) fail(ctx context.Context, actor identity.Actor, nodeID, code, message string) error {
	return s.store.Within(ctx, actor, func(tx actionapp.Transaction) error {
		return tx.SaveNodeDocuments(nodeID, []actionapp.NodeDocument{
			{Kind: "expression", Status: "failed", ErrorCode: code, ErrorMessage: message},
			{Kind: "agreement", Status: "failed", ErrorCode: code, ErrorMessage: message},
		})
	})
}

func parse(content string) (output, error) {
	content = strings.TrimSpace(content)
	if strings.HasPrefix(content, "```json") {
		content = strings.TrimSuffix(strings.TrimPrefix(content, "```json"), "```")
	}
	var value output
	decoder := json.NewDecoder(strings.NewReader(content))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&value); err != nil {
		return output{}, fault.New(fault.Invalid, "AI 返回格式不正确，请重试")
	}
	var extra json.RawMessage
	if err := decoder.Decode(&extra); err != io.EOF {
		return output{}, fault.New(fault.Invalid, "AI 返回格式不正确，请重试")
	}
	value.Expression, value.Agreement = strings.TrimSpace(value.Expression), strings.TrimSpace(value.Agreement)
	if value.Expression == "" || value.Agreement == "" {
		return output{}, fault.New(fault.Invalid, "AI 没有生成完整的表达和约定，请重试")
	}
	if utf8.RuneCountInString(value.Expression) > constants.ActionContentLimit || utf8.RuneCountInString(value.Agreement) > constants.ActionContentLimit {
		return output{}, fault.New(fault.Invalid, "AI 生成的文档过长，请重试")
	}
	return value, nil
}

func findNode(graph actionapp.Graph, nodeID string) (actionapp.Node, error) {
	for _, node := range graph.Nodes {
		if node.ID == nodeID {
			return node, nil
		}
	}
	return actionapp.Node{}, fault.New(fault.NotFound, "行动不存在")
}

func terminal(graph actionapp.Graph, nodeID string) bool {
	for _, edge := range graph.Edges {
		if edge.SourceID == nodeID {
			return false
		}
	}
	return true
}

// GenerateInput 只接受当前账号可编辑的节点身份。
type GenerateInput struct {
	NodeID string `json:"nodeId"`
}
