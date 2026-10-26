// Package generation 从服务端事实和私有对话生成草稿，不直接发布内容。
package generation

import (
	"context"
	"time"

	"github.com/singaurora/exec-graph/backend/internal/application/action"
	"github.com/singaurora/exec-graph/backend/internal/application/catalogue"
	"github.com/singaurora/exec-graph/backend/internal/application/identity"
)

// GenerateInput 只提交本轮输入和引用选择，历史事实及已有对话由服务端读取。
type GenerateInput struct {
	Mode            string                 `json:"mode"`
	GraphID         string                 `json:"graphId"`
	ConversationID  string                 `json:"conversationId,omitempty"`
	NodeID          string                 `json:"nodeId,omitempty"`
	ExpectedVersion uint32                 `json:"expectedVersion,omitempty"`
	Message         string                 `json:"message"`
	ParentID        string                 `json:"parentId,omitempty"`
	MergedParentIDs []string               `json:"mergedParentIds"`
	SourceVersions  []action.SourceVersion `json:"sourceVersions"`
	Agreement       action.DocumentUpdate  `json:"agreement"`
}

// Draft 是平台模型输出的可确认草稿，约定核对必须区分 null 和 false。
type Draft struct {
	Reply      string                    `json:"reply"`
	Title      string                    `json:"title"`
	Objective  string                    `json:"objective"`
	Expression action.DocumentUpdate     `json:"expression"`
	Reviews    []action.SourceAssessment `json:"reviews"`
}

// View 是仅生成发起者可读的结果及对应确认参数。
type View struct {
	GenerationID     string                        `json:"generationId"`
	ConversationID   string                        `json:"conversationId"`
	Status           string                        `json:"status"`
	ErrorCode        string                        `json:"errorCode,omitempty"`
	Draft            *Draft                        `json:"draft,omitempty"`
	CreateAction     *action.CreateActionInput     `json:"createAction,omitempty"`
	UpdateExpression *action.UpdateExpressionInput `json:"updateExpression,omitempty"`
}

// Message 描述实际传给模型的角色和正文。
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// Conversation 包含经过账号隔离的已确认历史及本人草稿。
type Conversation struct {
	ID            string
	Messages      []Message
	MessageIDs    []string
	NextSequence  uint32
	PreviousDraft *Draft
}

// Pending 固定本轮输入、实际消息清单、来源快照和生成身份。
type Pending struct {
	ID, RequestKey, Model, Mode, GraphID, NodeID, Guide, ActorID string
	Digest                                                       []byte
	ContextDigest                                                []byte
	Conversation                                                 Conversation
	InputMessage                                                 string
	ExpectedVersion                                              uint32
	InheritedExpressionID                                        string
	Agreement                                                    action.DocumentUpdate
	Sources                                                      []action.GenerationSource
	CreatedAt                                                    time.Time
}

// Request 是幂等请求的服务端指纹及已有生成状态。
type Request struct {
	Digest []byte
	View   View
}

// Transaction 只提供生成所需的事务能力。
type Transaction interface {
	Existing(string) (*Request, error)
	Usage(time.Time) (Usage, error)
	Graph(string) (action.Graph, error)
	Facts(string) ([]catalogue.ActionView, error)
	Conversation(GenerateInput) (Conversation, error)
	Reserve(Pending) error
	Get(string) (View, error)
	Complete(string, Draft, uint32, uint32) error
	Fail(string, string) error
}

// Store 在同一事务中校验账号版本、分配消息序号和保存生成结果。
type Store interface {
	Within(context.Context, identity.Actor, func(Transaction) error) error
}

// Completion 是平台客户端返回的内容和用量。
type Completion struct {
	Content                   string
	InputTokens, OutputTokens uint32
}

// Provider 由 bootstrap 注入平台模型，不接受用户密钥或任意上游地址。
type Provider interface {
	Model() string
	Complete(context.Context, []Message) (Completion, error)
}
