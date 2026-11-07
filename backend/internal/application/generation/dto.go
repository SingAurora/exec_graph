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
	Messages        []string               `json:"messages"`
	ParentID        string                 `json:"parentId,omitempty"`
	MergedParentIDs []string               `json:"mergedParentIds"`
	SourceVersions  []action.SourceVersion `json:"sourceVersions"`
	Agreement       action.DocumentUpdate  `json:"agreement"`
	Images          []action.ImageInput    `json:"images"`
	// CurrentDocument 是作者正在调整的私有表达/约定草案；仅 expression/agreement 模式使用。
	CurrentDocument string `json:"currentDocument,omitempty"`
}

// Draft 是平台模型输出的可确认草稿，约定核对必须区分 null 和 false。
type Draft struct {
	Reply         string                    `json:"reply"`
	Title         string                    `json:"title"`
	Objective     string                    `json:"objective"`
	Expression    action.DocumentUpdate     `json:"expression"`
	Agreement     *action.DocumentUpdate    `json:"agreement,omitempty"`
	Reviews       []action.SourceAssessment `json:"reviews"`
	Images        []action.ImageInput       `json:"images,omitempty"`
	InvalidImages []ImageIssue              `json:"invalidImages,omitempty"`
}

// ImageIssue 说明本轮没有放入正文的图片及原因。
type ImageIssue struct {
	Ref    string `json:"ref"`
	Reason string `json:"reason"`
}

// PlaceImagesInput 只对已有行动草稿做图片放置，不提交正文或新的行动报告。
type PlaceImagesInput struct {
	GenerationID string              `json:"generationId"`
	Images       []action.ImageInput `json:"images"`
}

// Placement 是图片放置事务内读取的当前草稿。
type Placement struct {
	GenerationID string
	ActorID      string
	Mode         string
	Status       string
	Objective    string
	Confirmed    bool
}

// View 是仅生成发起者可读的结果及对应确认参数。
type View struct {
	GenerationID     string                        `json:"generationId"`
	ConversationID   string                        `json:"conversationId"`
	Status           string                        `json:"status"`
	Model            string                        `json:"model,omitempty"`
	ErrorCode        string                        `json:"errorCode,omitempty"`
	Draft            *Draft                        `json:"draft,omitempty"`
	CreateAction     *action.CreateActionInput     `json:"createAction,omitempty"`
	UpdateExpression *action.UpdateExpressionInput `json:"updateExpression,omitempty"`
	UpdateAgreement  *action.UpdateAgreementInput  `json:"updateAgreement,omitempty"`
}

// Message 描述实际传给模型的角色和正文。
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
	// AuthorID 仅用于服务端区分报告者，不传给上游消息协议。
	AuthorID string `json:"-"`
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
	InputMessages                                                []string
	Images                                                       []action.ImageInput
	Initial                                                      bool
	CurrentDocument                                              string
	InputThroughSequence                                         uint32
	ExpectedVersion                                              uint32
	InheritedExpressionID                                        string
	Agreement                                                    action.DocumentUpdate
	Sources                                                      []action.GenerationSource
	CreatedAt                                                    time.Time
	snapshot                                                     contextSnapshot
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
	CheckAssets(...*string) error
	Placement(string) (Placement, error)
	UpdatePlacement(string, string) (View, error)
	Reserve(Pending) error
	Get(string) (View, error)
	VerifyContext(string) (VerificationContext, error)
	Complete(string, Draft, uint32, uint32) error
	Fail(string, string) error
}

// Store 在同一事务中校验账号版本、分配消息序号和保存生成结果。
type Store interface {
	Within(context.Context, identity.Actor, func(Transaction) error) error
}

// Report 是显式核验时重建的用户报告。
type Report struct{ ID, Text string }

// VerificationContext 是显式核验读取的服务端上下文。
type VerificationContext struct {
	Mode      string
	ActorID   string
	NodeID    string
	Guide     string
	HasParent bool
	Graph     action.Graph
	Facts     []catalogue.ActionView
	Sources   []action.GenerationSource
	Reports   []Report
	Draft     Draft
}

// VerifyView 是一次显式核验的公开结果。
type VerifyView struct {
	GenerationID  string                    `json:"generationId"`
	Status        string                    `json:"status"`
	Message       string                    `json:"message"`
	SourceReviews []action.SourceAssessment `json:"sourceReviews"`
}

// Completion 是平台客户端返回的内容和用量。
type Completion struct {
	Content                   string
	InputTokens, OutputTokens uint32
}

// Provider 由 bootstrap 注入一个平台模型，不接受用户密钥或任意上游地址。
type Provider interface {
	Model() string
	Complete(context.Context, []Message) (Completion, error)
}

// VerifyInput 指定要核验的已生成草稿。
type VerifyInput struct {
	GenerationID string `json:"generationId"`
}

// ChatInput 在同一轮对话中携带当前草稿，供服务端判断是继续生成还是核验。
type ChatInput struct {
	GenerateInput
	GenerationID string `json:"generationId,omitempty"`
}

// ChatView 是对话路由结果：要么生成草稿，要么核验当前草稿。
type ChatView struct {
	Kind         string      `json:"kind"`
	Generation   *View       `json:"generation,omitempty"`
	Verification *VerifyView `json:"verification,omitempty"`
}
