package generation

import (
	"encoding/json"
	"io"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/singaurora/exec-graph/backend/internal/application/action"
	"github.com/singaurora/exec-graph/backend/internal/application/catalogue"
	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
)

type fact struct {
	NodeID    string `json:"nodeId"`
	Number    uint32 `json:"number"`
	ActorID   string `json:"actorId"`
	Title     string `json:"title"`
	Objective string `json:"objective"`
}
type source struct {
	NodeID     string `json:"nodeId"`
	Expression string `json:"expression"`
	Agreement  string `json:"agreement"`
}
type contextSnapshot struct {
	Mode                string                `json:"mode"`
	ActorID             string                `json:"actorId"`
	NodeID              string                `json:"nodeId,omitempty"`
	Reports             []report              `json:"reports"`
	Guide               string                `json:"guide"`
	HasParent           bool                  `json:"hasParent"`
	Facts               []fact                `json:"facts"`
	Sources             []source              `json:"sources"`
	OriginalSources     []source              `json:"originalSources,omitempty"`
	CurrentExpression   string                `json:"currentExpression"`
	CurrentAgreement    string                `json:"currentAgreement"`
	DownstreamAgreement action.DocumentUpdate `json:"downstreamAgreement"`
	PreviousDraft       *Draft                `json:"previousDraft,omitempty"`
}

type report struct {
	ID   string `json:"id"`
	Text string `json:"text"`
}

func snapshotFor(graph action.Graph, history map[string]bool, nodes []catalogue.ActionView, p Pending, hasParent bool) contextSnapshot {
	snapshot := contextSnapshot{Mode: p.Mode, ActorID: p.ActorID, NodeID: p.NodeID, Reports: []report{}, Guide: p.Guide, HasParent: hasParent, Facts: []fact{}, Sources: []source{}, DownstreamAgreement: p.Agreement, PreviousDraft: p.Conversation.PreviousDraft}
	for i, message := range p.Conversation.Messages {
		if message.Role == "user" && message.AuthorID == p.ActorID && p.ActorID != "" {
			snapshot.Reports = append(snapshot.Reports, report{"report-" + strconv.Itoa(i), message.Content})
		}
	}
	for i, message := range p.InputMessages {
		snapshot.Reports = append(snapshot.Reports, report{"current-report-" + strconv.Itoa(i), message})
	}
	byNode := map[string]action.Node{}
	for _, node := range graph.Nodes {
		byNode[node.ID] = node
		if (p.Mode == "expression" || p.Mode == "agreement") && node.ID == p.NodeID {
			snapshot.CurrentExpression = node.Expression.Markdown
			snapshot.CurrentAgreement = node.Agreement.Markdown
		}
	}
	for _, node := range nodes {
		if history[node.ID] {
			snapshot.Facts = append(snapshot.Facts, fact{node.ID, node.Number, node.AuthorID, node.Title, node.ObjectiveMarkdown})
		}
	}
	for _, s := range p.Sources {
		n := byNode[s.NodeID]
		snapshot.Sources = append(snapshot.Sources, source{s.NodeID, n.Expression.Markdown, n.Agreement.Markdown})
		if s.Kind == "primary" {
			snapshot.CurrentExpression = n.Expression.Markdown
		}
	}
	if p.Mode == "expression" || p.Mode == "agreement" {
		for _, edge := range graph.Edges {
			if edge.TargetID == p.NodeID {
				n := byNode[edge.SourceID]
				snapshot.OriginalSources = append(snapshot.OriginalSources, source{n.ID, n.Expression.Markdown, n.Agreement.Markdown})
			}
		}
	}
	return snapshot
}

func prompt(snapshot contextSnapshot, p Pending) ([]Message, error) {
	encoded, err := json.Marshal(snapshot)
	if err != nil {
		return nil, err
	}
	rules := generationRules + "\n当前服务端快照：" + string(encoded)
	messages := append([]Message{{Role: "system", Content: rules}}, p.Conversation.Messages...)
	for _, report := range p.InputMessages {
		messages = append(messages, Message{Role: "user", Content: report})
	}
	total := 0
	for _, message := range messages {
		total += utf8.RuneCountInString(message.Content)
	}
	if total > constants.AIContextLimit {
		return nil, fault.New(fault.Invalid, "引用背景或对话过长，请减少引用或另开行动")
	}
	return messages, nil
}

type modelDocument struct {
	Mode     string `json:"mode"`
	Markdown string `json:"markdown"`
}
type modelDraft struct {
	Reply      string                    `json:"reply"`
	Title      string                    `json:"title"`
	Objective  string                    `json:"objective"`
	Expression *modelDocument            `json:"expression"`
	Agreement  *modelDocument            `json:"agreement"`
	Reviews    []action.SourceAssessment `json:"reviews"`
}

func parse(content, mode string, hasParent bool, sources []action.GenerationSource) (Draft, error) {
	content = strings.TrimSpace(content)
	if strings.HasPrefix(content, "```json") {
		content = strings.TrimSuffix(strings.TrimPrefix(content, "```json"), "```")
	}
	var raw modelDraft
	decoder := json.NewDecoder(strings.NewReader(content))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&raw); err != nil {
		return Draft{}, err
	}
	var extra json.RawMessage
	if err := decoder.Decode(&extra); err != io.EOF {
		return Draft{}, fault.New(fault.Invalid, "AI 输出包含额外内容")
	}
	if len(sources) == 0 {
		raw.Reviews = []action.SourceAssessment{}
	}
	if strings.TrimSpace(raw.Reply) == "" {
		if mode == "action" && strings.TrimSpace(raw.Title) == "" && strings.TrimSpace(raw.Objective) == "" {
			return Draft{}, fault.New(fault.Invalid, "这次还没有具体行动可整理。请说说你实际做了什么、结果如何，或有什么感受。")
		}
		return Draft{}, fault.New(fault.Invalid, "这次整理没有完成，请重新发送。")
	}
	if (raw.Expression == nil && mode == "expression") || (raw.Expression != nil && (mode == "agreement" || (mode == "action" && len(sources) > 0))) || utf8.RuneCountInString(raw.Reply) > constants.AIInputLimit || raw.Reviews == nil || len(raw.Reviews) != len(sources) {
		return Draft{}, fault.New(fault.Invalid, "这次整理没有完成，请重新发送。")
	}
	doc := action.DocumentUpdate{Mode: "clear"}
	if raw.Expression != nil {
		doc = action.DocumentUpdate{Mode: raw.Expression.Mode}
		if doc.Mode == "update" {
			doc.Markdown = &raw.Expression.Markdown
		} else if raw.Expression.Markdown != "" {
			return Draft{}, fault.New(fault.Invalid, "继承或清空不能携带文稿")
		}
		if err := action.ValidateDocument(doc, mode == "action" && hasParent); err != nil {
			return Draft{}, err
		}
	}
	if mode == "action" {
		doc = action.DocumentUpdate{Mode: "clear"}
		if hasParent {
			doc = action.DocumentUpdate{Mode: "inherit"}
		}
	}
	if mode == "action" && (strings.TrimSpace(raw.Title) == "" || strings.TrimSpace(raw.Objective) == "") {
		return Draft{}, fault.New(fault.Invalid, "请补充这次实际做了什么、过程、结果或明确感受")
	}
	if mode == "action" && utf8.RuneCountInString(raw.Title) > constants.ActionTitleLimit {
		return Draft{}, fault.New(fault.Invalid, "行动标题超过"+strconv.Itoa(constants.ActionTitleLimit)+"字，请精简后重试")
	}
	if mode == "action" && utf8.RuneCountInString(raw.Objective) > constants.ActionContentLimit {
		return Draft{}, fault.New(fault.Invalid, "行动正文超过"+strconv.Itoa(constants.ActionContentLimit)+"字，请精简或拆成多个行动后重试")
	}
	if (mode == "expression" || mode == "agreement") && (raw.Title != "" || raw.Objective != "") {
		return Draft{}, fault.New(fault.Invalid, "表达修改不能携带新行动事实")
	}
	var agreement *action.DocumentUpdate
	if mode == "agreement" {
		if raw.Agreement == nil || len(sources) != 0 || len(raw.Reviews) != 0 {
			return Draft{}, fault.New(fault.Invalid, "约定输出不完整")
		}
		value := action.DocumentUpdate{Mode: raw.Agreement.Mode}
		if value.Mode == "update" {
			value.Markdown = &raw.Agreement.Markdown
		} else if raw.Agreement.Markdown != "" {
			return Draft{}, fault.New(fault.Invalid, "继承或清空不能携带约定文稿")
		}
		if err := action.ValidateDocument(value, false); err != nil {
			return Draft{}, err
		}
		agreement = &value
	}
	byID := map[string]action.SourceAssessment{}
	for _, review := range raw.Reviews {
		if !review.Provided {
			return Draft{}, fault.New(fault.Invalid, "AI 未明确核对状态")
		}
		if _, exists := byID[review.SourceID]; exists {
			return Draft{}, fault.New(fault.Invalid, "AI 来源核对重复")
		}
		if review.Complies != nil && !*review.Complies {
			if review.ExceptionReason == nil || strings.TrimSpace(*review.ExceptionReason) == "" || utf8.RuneCountInString(*review.ExceptionReason) > constants.ContextGuideLimit {
				return Draft{}, fault.New(fault.Invalid, "AI 未说明不满足约定的原因")
			}
		} else {
			// 初稿偶尔给未知状态附说明；不把它当作不符理由，最终由独立核验重算。
			review.ExceptionReason = nil
		}
		byID[review.SourceID] = review
	}
	reviews := []action.SourceAssessment{}
	for _, source := range sources {
		review, ok := byID[source.NodeID]
		if !ok {
			return Draft{}, fault.New(fault.Invalid, "AI 来源核对与引用不一致")
		}
		if source.AgreementStatus == "unrestricted" {
			review.Complies, review.ExceptionReason = nil, nil
		}
		reviews = append(reviews, review)
	}
	return Draft{Reply: raw.Reply, Title: raw.Title, Objective: raw.Objective, Expression: doc, Agreement: agreement, Reviews: reviews}, nil
}
