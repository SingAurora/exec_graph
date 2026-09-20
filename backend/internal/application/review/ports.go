package review

import (
	"context"
	"errors"
	"time"

	applicationaigateway "github.com/singaurora/exec-graph/backend/internal/application/aigateway"
	applicationaikey "github.com/singaurora/exec-graph/backend/internal/application/aikey"
)

// ErrNotFound 表示审查目标不存在或不属于当前用户。
var ErrNotFound = errors.New("review target not found")

// NodeReviewContext 是完成审查需要的节点、项目与合约事实。
type NodeReviewContext struct {
	ProjectID                string
	ProjectTitle             string
	ProjectDescription       string
	ProjectRules             string
	ArchivedAt               *time.Time
	IsCurrent                bool
	NodeID                   string
	Title                    string
	OriginalIntent           string
	Goal                     string
	CriteriaJSON             string
	EvidenceRequirement      string
	SmartContractID          string
	MessagesJSON             string
	Stage                    string
	Claim                    *string
	Evidence                 *string
	ReviewJSON               *string
	ReviewConfigJSON         *string
	ReviewRoundsJSON         *string
	SmartContractName        string
	SmartContractDescription string
	SmartContractBody        string
}

// ClosureSource 是收束审查中的一个上游节点。
type ClosureSource struct {
	ID       string
	Title    string
	Goal     string
	Criteria string
	Evidence string
}

// InitialReviewSave 保存首次完成提交与审查结果。
type InitialReviewSave struct {
	UserID                                                    uint64
	NodeID, CompletionClaim, EvidenceText                     string
	StartedAt, EndedAt                                        *time.Time
	Stage, ReviewJSON, AIConfigJSON, RoundsJSON, MessagesJSON string
}

// ClarificationReviewSave 保存补充审查结果。
type ClarificationReviewSave struct {
	NodeID, Stage, ReviewJSON, AIConfigJSON, RoundsJSON, MessagesJSON string
}

// Repository 定义完成审查用例需要的持久化能力。
type Repository interface {
	LoadNodeReviewContext(ctx context.Context, userID uint64, nodeUUID string) (NodeReviewContext, error)
	ListClosureSourceUUIDs(ctx context.Context, targetNodeUUID string) ([]string, error)
	LoadClosureSource(ctx context.Context, sourceNodeUUID, projectUUID string) (ClosureSource, error)
	SaveInitialReview(ctx context.Context, input InitialReviewSave) (bool, error)
	SaveClarificationReview(ctx context.Context, input ClarificationReviewSave) (bool, error)
}

// CredentialProvider 提供项目审查凭据并记录使用时间。
type CredentialProvider interface {
	FindProjectReviewKey(ctx context.Context, userID uint64, projectUUID string) (applicationaikey.Credential, error)
	MarkAIKeyUsed(ctx context.Context, userID uint64, keyUUID string) error
}

// Dependencies 是审查应用服务需要的端口。
type Dependencies struct {
	ModelClient applicationaigateway.Client
	Repository  Repository
	Credentials CredentialProvider
}
