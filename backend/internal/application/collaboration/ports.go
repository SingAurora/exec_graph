package collaboration

import (
	"context"
	"errors"
	"time"

	applicationaikey "github.com/singaurora/exec-graph/backend/internal/application/aikey"
	applicationreview "github.com/singaurora/exec-graph/backend/internal/application/review"
)

var (
	ErrRecordNotFound     = errors.New("collaboration record not found")
	ErrRecordInvalidState = errors.New("collaboration record invalid state")
	ErrRecordPartial      = errors.New("collaboration record partial update")
	ErrRecordCorrupt      = errors.New("collaboration record corrupt")
	ErrRecordUnauthorized = errors.New("collaboration record unauthorized")
)

type CallRecord struct {
	ID, ProjectID, TargetContractID, CreatedBy uint64
	UUID, Title, Status                        string
	MaxSubmissions                             int
	CreatedAt                                  time.Time
}

type SubmissionRecord struct {
	ID, CallID, SourceRecordID, ContributorID uint64
	UUID, MappingText, Note, Status           string
	CreatedAt, UpdatedAt                      time.Time
}

type ReviewBatchRecord struct {
	ID, CallID, ProjectID, TargetContractID, CreatedBy uint64
	UUID, SubmissionIDsJSON, AIReviewJSON, Status      string
	CreatedAt                                          time.Time
	AdoptedAt                                          *time.Time
}

type CallViewRecord struct {
	InternalID, CreatedBy                                                               uint64
	ID, ProjectID, ProjectTitle, OwnerName, OwnerUserID, CreatedByUserID                string
	Title, Status, TargetID, TargetTitle, VerifiableGoal, CriteriaJSON, Evidence, Stage string
	MaxSubmissions, SubmissionCount                                                     int
	CreatedAt                                                                           time.Time
}

type ProjectViewRecord struct {
	ID, Title, Description, OwnerName, OwnerUserID string
	NodeCount, AcceptedCount, OpenCallCount        int
	UpdatedAt                                      time.Time
}

type SubmissionViewRecord struct {
	ID, CallID, SourceRecordID, SourceTitle, SourceSummary, SourceProjectTitle string
	ContributorID                                                              uint64
	ContributorName, ContributorUserID, MappingText, Note, Status              string
	CreatedAt                                                                  time.Time
}

type TargetContextRecord struct {
	ProjectID, TargetContractID                 uint64
	TargetTitle, TargetStage, ProjectVisibility string
}

type ReviewContextRecord struct {
	ProjectTitle, ProjectDescription, ProjectRules, OriginalIntent           string
	SmartContractID, SmartContractName, SmartContractDesc, SmartContractBody string
}

type ContributionSourceRecord struct{ ID, Title, Summary, ProjectTitle string }
type ContributionActivityRecord struct {
	Submission SubmissionViewRecord
	Call       CallViewRecord
}

type Repository interface {
	CreateCall(ctx context.Context, call *CallRecord) error
	FindCallTarget(ctx context.Context, projectUUID, targetUUID string, ownerID uint64) (TargetContextRecord, error)
	HasOpenCall(ctx context.Context, projectID, targetContractID uint64) (bool, error)
	ListPublicProjects(ctx context.Context) ([]ProjectViewRecord, error)
	FindPublicProject(ctx context.Context, projectUUID string) (ProjectViewRecord, error)
	ListCallIDs(ctx context.Context, projectUUID string) ([]string, error)
	FindCall(ctx context.Context, callUUID string) (CallViewRecord, error)
	ListSubmissions(ctx context.Context, callUUID string, selected []string) ([]SubmissionViewRecord, error)
	FindSourceOwner(ctx context.Context, recordUUID string) (uint64, error)
	FindCallID(ctx context.Context, uuid string) (uint64, error)
	FindProjectID(ctx context.Context, uuid string) (uint64, error)
	FindTargetID(ctx context.Context, uuid string) (uint64, error)
	FindRecordID(ctx context.Context, uuid string) (uint64, error)
	CreateSubmission(ctx context.Context, submission *SubmissionRecord) error
	FindReviewContext(ctx context.Context, projectUUID, targetUUID string) (ReviewContextRecord, error)
	CreateReviewBatch(ctx context.Context, batch *ReviewBatchRecord, submissionUUIDs []string) error
	AdoptReview(ctx context.Context, batchUUID string, userID uint64) error
	ListContributionSources(ctx context.Context, userID uint64) ([]ContributionSourceRecord, error)
	ListContributionActivities(ctx context.Context, userID uint64) ([]ContributionActivityRecord, error)
}

// CredentialProvider 提供目标项目配置的 AI 审查凭据。
type CredentialProvider interface {
	FindProjectReviewKey(ctx context.Context, userID uint64, projectUUID string) (applicationaikey.Credential, error)
	MarkAIKeyUsed(ctx context.Context, userID uint64, keyUUID string) error
}

// Dependencies 是协作应用服务需要的端口。
type Dependencies struct {
	Repository  Repository
	Credentials CredentialProvider
	Reviewer    *applicationreview.Service
}
