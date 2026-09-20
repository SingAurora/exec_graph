package workoverview

import (
	"context"
	"time"

	applicationaigateway "github.com/singaurora/exec-graph/backend/internal/application/aigateway"
	applicationaikey "github.com/singaurora/exec-graph/backend/internal/application/aikey"
)

// ActivityRecord 是工作总览的数据库读取投影。
type ActivityRecord struct {
	ID, ProjectID, ProjectTitle, NodeID, Title, Detail, RecordKind string
	CreatedAt                                                      time.Time
	StartedAt, EndedAt                                             *time.Time
}

// ReviewRecord 是已保存日结的数据库读取投影。
type ReviewRecord struct {
	ID, Date, ReviewJSON, AIConfig string
	CreatedAt, UpdatedAt           time.Time
}

// ReviewContent 是日结持久化的稳定 JSON 内容。
type ReviewContent struct {
	Summary    string   `json:"summary"`
	Momentum   string   `json:"momentum"`
	Highlights []string `json:"highlights"`
	Friction   []string `json:"friction"`
	NextStep   string   `json:"nextStep"`
}

// Repository 定义工作总览用例需要的持久化能力。
type Repository interface {
	ListActivities(ctx context.Context, userID uint64, start, end time.Time) ([]ActivityRecord, error)
	ListReviews(ctx context.Context, userID uint64, start, end time.Time) ([]ReviewRecord, error)
	SaveReview(ctx context.Context, userID uint64, date time.Time, content ReviewContent, aiConfig, reviewUUID string) error
}

// CredentialProvider 提供日结可用的最近项目 AI 凭据。
type CredentialProvider interface {
	FindLatestProjectReviewKey(ctx context.Context, userID uint64) (applicationaikey.Credential, error)
	MarkAIKeyUsed(ctx context.Context, userID uint64, keyUUID string) error
}

// Dependencies 是工作总览应用服务需要的端口。
type Dependencies struct {
	Repository  Repository
	Credentials CredentialProvider
	ModelClient applicationaigateway.Client
}
