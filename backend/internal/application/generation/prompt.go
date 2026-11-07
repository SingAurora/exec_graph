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
	Feedback            string                `json:"feedback,omitempty"`
	Images              []snapshotImage       `json:"images,omitempty"`
	Initial             bool                  `json:"initial,omitempty"`
}

type snapshotImage struct {
	Ref string `json:"ref"`
	Alt string `json:"alt"`
}

type report struct {
	ID   string `json:"id"`
	Text string `json:"text"`
}

func snapshotFor(graph action.Graph, history map[string]bool, nodes []catalogue.ActionView, p Pending, hasParent bool) contextSnapshot {
	snapshot := contextSnapshot{Mode: p.Mode, ActorID: p.ActorID, NodeID: p.NodeID, Reports: []report{}, Guide: "", HasParent: hasParent, Facts: []fact{}, Sources: []source{}, DownstreamAgreement: p.Agreement, PreviousDraft: p.Conversation.PreviousDraft, Feedback: p.Feedback, Images: []snapshotImage{}, Initial: p.Initial}
	for i, image := range p.Images {
		snapshot.Images = append(snapshot.Images, snapshotImage{Ref: "image:" + strconv.Itoa(i+1), Alt: image.Alt})
	}
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
	if p.CurrentDocument != "" {
		if p.Mode == "expression" {
			snapshot.CurrentExpression = p.CurrentDocument
		} else if p.Mode == "agreement" {
			snapshot.CurrentAgreement = p.CurrentDocument
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
	rules := generationRulesFor(p.Mode) + "\n当前服务端快照：" + string(encoded)
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
	Reply         string                    `json:"reply"`
	Title         string                    `json:"title"`
	Objective     string                    `json:"objective"`
	Expression    *modelDocument            `json:"expression"`
	Agreement     *modelDocument            `json:"agreement"`
	Reviews       []action.SourceAssessment `json:"reviews"`
	InvalidImages []ImageIssue              `json:"invalidImages"`
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
	// 当前模式不使用的字段由模型偶尔带出；不因此丢弃已经完整的必要文档。
	if mode == "action" {
		raw.Expression, raw.Agreement = nil, nil
	} else if mode == "agreement" {
		raw.Expression = nil
	}
	if strings.TrimSpace(raw.Reply) == "" {
		switch mode {
		case "action":
			if strings.TrimSpace(raw.Title) == "" && strings.TrimSpace(raw.Objective) == "" {
				return Draft{}, fault.New(fault.Invalid, "这次还没有具体行动可整理。请说说你实际做了什么、结果如何，或有什么感受。")
			}
			raw.Reply = "已整理本次行动，请在“行动”标签页查看草稿。"
		case "expression":
			if raw.Expression == nil {
				return Draft{}, fault.New(fault.Invalid, "这次表达整理没有完成，请重新发送。")
			}
			raw.Reply = "已更新表达草稿，请在“表达”标签页查看。"
		case "agreement":
			if raw.Agreement == nil {
				return Draft{}, fault.New(fault.Invalid, "这次约定整理没有完成，请重新发送。")
			}
			raw.Reply = "已更新约定草稿，请在“约定”标签页查看。"
		}
	}
	if (raw.Expression == nil && mode == "expression") || utf8.RuneCountInString(raw.Reply) > constants.AIInputLimit {
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
		return Draft{}, fault.New(fault.Invalid, "请补充这次实际做了什么、过程、结果或明确感受；如果是复盘，可以按“我先……然后……”来说")
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
		if _, exists := byID[review.SourceID]; exists {
			// 重复项不信任任一判断，降级为未知，最终仍由独立核验重算。
			byID[review.SourceID] = action.SourceAssessment{SourceID: review.SourceID, Provided: true}
			continue
		}
		if !review.Provided || (review.Complies != nil && !*review.Complies && (review.ExceptionReason == nil || strings.TrimSpace(*review.ExceptionReason) == "" || utf8.RuneCountInString(*review.ExceptionReason) > constants.ContextGuideLimit)) {
			// 缺失、未明确或没有理由的不符都降级为未知，不能让格式问题中断行动整理。
			review.Complies, review.ExceptionReason, review.Provided = nil, nil, true
		}
		if review.Complies == nil {
			review.ExceptionReason = nil
		}
		byID[review.SourceID] = review
	}
	reviews := []action.SourceAssessment{}
	for _, source := range sources {
		review, ok := byID[source.NodeID]
		if !ok {
			review = action.SourceAssessment{SourceID: source.NodeID, Provided: true}
		}
		if source.AgreementStatus == "unrestricted" {
			review.Complies, review.ExceptionReason = nil, nil
		}
		reviews = append(reviews, review)
	}
	return Draft{Reply: raw.Reply, Title: raw.Title, Objective: raw.Objective, Expression: doc, Agreement: agreement, Reviews: reviews, InvalidImages: raw.InvalidImages}, nil
}
