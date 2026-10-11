package conversation

import (
	"context"
	"errors"
	"time"

	applicationaigateway "github.com/singaurora/exec-graph/backend/internal/application/aigateway"
	applicationaikey "github.com/singaurora/exec-graph/backend/internal/application/aikey"
	applicationproject "github.com/singaurora/exec-graph/backend/internal/application/project"
	applicationreview "github.com/singaurora/exec-graph/backend/internal/application/review"
)

// ErrNotFound 表示对话、项目或节点不存在。
var ErrNotFound = errors.New("conversation resource not found")

// ErrNoLongerMutable 表示迟到的 AI 结果不能再覆盖已锁定状态。
var ErrNoLongerMutable = errors.New("conversation no longer mutable")

// ErrConversationAlreadyExists 表示同一业务对象已经有活动对话。
var ErrConversationAlreadyExists = errors.New("active conversation already exists")

// PlanningMessage 是规划对话中需要复制到节点记录的消息。
type PlanningMessage struct {
	UUID, Role, Body string
	CreatedAt        time.Time
}

// ProjectContext 是创建规划对话所需的项目事实。
type ProjectContext struct {
	UUID                     string
	Title                    string
	Description              string
	Rules                    string
	SmartContractID          string
	SmartContractName        string
	SmartContractDescription string
	SmartContractBody        string
	ContributionCallID       *string
	ArchivedAt               *time.Time
}

// SourceContext 是带入规划对话的既有节点事实。
type SourceContext struct {
	UUID                string
	Title               string
	Goal                string
	EvidenceRequirement string
	Stage               string
	CompletionClaim     *string
	EvidenceText        *string
	ReviewJSON          *string
}

// RevisionTarget 是允许修改要求的当前节点及其原要求。
type RevisionTarget struct {
	NodeUUID            string
	Title               string
	Goal                string
	CriteriaJSON        string
	EvidenceRequirement string
	Stage               string
	Current             bool
	Archived            bool
	HasCompletionRecord bool
}

// RevisionSave 是用户确认后原子替换任务要求的内容。
type RevisionSave struct {
	UserID              uint64
	ConversationUUID    string
	NodeUUID            string
	Title               string
	Goal                string
	CriteriaJSON        string
	EvidenceRequirement string
	OriginalIntent      string
	DraftJSON           string
	ReviewJSON          string
	AIConfigJSON        string
	MessagesJSON        string
}

// CompletionContext 是创建完成审查对话所需的项目与节点事实。
type CompletionContext struct {
	NodeTitle                string
	Goal                     string
	EvidenceRequirement      string
	AcceptanceCriteriaJSON   string
	Stage                    string
	ProjectTitle             string
	ProjectDescription       string
	Rules                    string
	SmartContractID          string
	SmartContractName        string
	SmartContractDescription string
	SmartContractBody        string
}

// ConversationRecord 是对话仓储返回的持久化记录。
type ConversationRecord struct {
	UUID             string
	Phase            string
	Status           string
	ContextJSON      string
	CurrentDraftJSON *string
	LatestReviewJSON *string
	AIConfigJSON     *string
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

// MessageRecord 是对话消息仓储返回的持久化记录。
type MessageRecord struct {
	UUID                  string
	Role                  string
	Body                  string
	StructuredPayloadJSON *string
	AIConfigJSON          *string
	CreatedAt             time.Time
}

// ConversationRecordView 聚合一份对话及其公开资源 UUID 和消息。
type ConversationRecordView struct {
	Conversation ConversationRecord
	ProjectID    string
	NodeID       *string
	Messages     []MessageRecord
}

// CompletionReviewSave 是完成审查对话最终结论的原子保存内容。
type CompletionReviewSave struct {
	UserID         uint64
	ConversationID string
	NodeID         string
	Claim          string
	Evidence       string
	StartedAt      *time.Time
	EndedAt        *time.Time
	Stage          string
	ReviewJSON     string
	RoundsJSON     string
	ConfigJSON     string
	MessagesJSON   string
	PayloadJSON    string
	Reply          string
	MessageID      string
}

// Repository 定义规划对话向执行节点交接所需的持久化能力。
type Repository interface {
	ListPlanningMessages(ctx context.Context, conversationUUID string, ownerID uint64) ([]PlanningMessage, error)
	UpdateReviewMessages(ctx context.Context, nodeUUID, messagesJSON string) error
	FindProjectContext(ctx context.Context, userID uint64, projectUUID string) (ProjectContext, error)
	ListSourceContexts(ctx context.Context, projectUUID string, sourceUUIDs []string) ([]SourceContext, error)
	FindPlanningConversation(ctx context.Context, userID uint64, projectUUID, contextJSON string) (string, error)
	CreatePlanningConversation(ctx context.Context, conversationUUID string, userID uint64, projectUUID, contextJSON string) error
	FindRevisionTarget(ctx context.Context, userID uint64, projectUUID, nodeUUID string) (RevisionTarget, error)
	FindRevisionConversation(ctx context.Context, userID uint64, nodeUUID string) (string, error)
	CreateRevisionConversation(ctx context.Context, conversationUUID string, userID uint64, projectUUID, nodeUUID, contextJSON string) error
	SaveRevision(ctx context.Context, input RevisionSave) error
	FindCompletionConversation(ctx context.Context, userID uint64, projectUUID, nodeUUID string) (string, error)
	FindCompletionContext(ctx context.Context, userID uint64, projectUUID, nodeUUID string) (CompletionContext, error)
	CreateCompletionConversation(ctx context.Context, conversationUUID string, userID uint64, projectUUID, nodeUUID, contextJSON, configJSON string) error
	FindConversation(ctx context.Context, userID uint64, conversationUUID string) (ConversationRecordView, error)
	ClearConversation(ctx context.Context, userID uint64, conversationUUID, replacementUUID string) error
	AddUserMessage(ctx context.Context, messageUUID string, userID uint64, conversationUUID, body string) error
	AddAssistantMessage(ctx context.Context, messageUUID string, userID uint64, conversationUUID, body, payloadJSON, configJSON string) error
	UpdatePlanningConversation(ctx context.Context, userID uint64, conversationUUID, status, draftJSON, messageUUID, body, payloadJSON, configJSON string) error
	PersistCompletionReview(ctx context.Context, input CompletionReviewSave) error
}

// CredentialProvider 提供项目配置的 AI 凭据并记录使用时间。
type CredentialProvider interface {
	FindProjectReviewKey(ctx context.Context, userID uint64, projectUUID string) (applicationaikey.Credential, error)
	MarkAIKeyUsed(ctx context.Context, userID uint64, keyUUID string) error
}

// ContributionOriginProvider 读取贡献项目的原始交接上下文。
type ContributionOriginProvider interface {
	GetContributionOrigin(ctx context.Context, callUUID string) (applicationproject.ContributionOrigin, error)
}

// Dependencies 是对话应用服务需要的端口。
type Dependencies struct {
	Repository          Repository
	Credentials         CredentialProvider
	ContributionOrigins ContributionOriginProvider
	ModelClient         applicationaigateway.Client
	Reviewer            *applicationreview.Service
}
