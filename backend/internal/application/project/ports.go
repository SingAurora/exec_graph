package project

import (
	"context"
	"errors"
	"time"
)

var (
	ErrProjectRecordNotFound  = errors.New("project record not found")
	ErrProjectRecordInvalid   = errors.New("project record invalid")
	ErrProjectRecordAdopted   = errors.New("project contains adopted content")
	ErrContractRecordNotFound = errors.New("contract record not found")
	ErrContractRecordInUse    = errors.New("contract record in use")
)

type ProjectRecord struct {
	ID, OwnerID                                                                     uint64
	UUID, Title, Description, ProjectType, Visibility                               string
	ProjectRules, ContributionOriginSnapshotJSON                                    *string
	DefaultAIKeyID, ContributionCallID, CurrentContractID, ActiveContractRevisionID *uint64
	IsDefault                                                                       bool
	CreatedAt                                                                       time.Time
	ArchivedAt                                                                      *time.Time
}

type ProjectContractRevisionRecord struct {
	ID, ProjectID, SmartContractID                                                      uint64
	UUID, SmartContractUUID, SmartContractVersion, Reason                               string
	SmartContractName, SmartContractDescription, SmartContractBody, SmartContractSource string
	ActivatedAt, SmartContractCreatedAt                                                 time.Time
}

type CreateProjectRecord struct {
	UUID, RevisionUUID, Title, Description, ProjectType, ProjectRules, Visibility string
	SmartContractUUID, AIKeyUUID, ContributionCallUUID, OriginSnapshot            string
	OwnerID                                                                       uint64
}

type SetContractRecord struct {
	ProjectUUID, ContractUUID, RevisionUUID string
	OwnerID                                 uint64
}

type ContributionOriginRecord struct {
	CallID, ProjectID, ProjectTitle, CallTitle, Status, TargetTitle string
	Goal, CriteriaJSON, EvidenceRequirement                         string
}

type ContributionSourceRecord struct{ Title, ProjectTitle, MappingText, Status string }

type ProjectRepository interface {
	ListIDsForOwner(ctx context.Context, userID uint64) ([]string, error)
	FindForOwner(ctx context.Context, userID uint64, projectUUID string) (ProjectRecord, error)
	HasAdoptedContributions(ctx context.Context, projectUUID string) (bool, error)
	UpdateActive(ctx context.Context, userID uint64, projectUUID, title, description, visibility string) (bool, error)
	Archive(ctx context.Context, userID uint64, projectUUID string) (bool, error)
	Unarchive(ctx context.Context, userID uint64, projectUUID string) (bool, error)
	SetAIKey(ctx context.Context, userID uint64, projectUUID, keyUUID string) (bool, error)
	ListContractRevisions(ctx context.Context, projectUUID string) ([]ProjectContractRevisionRecord, error)
	UUIDByInternalID(ctx context.Context, table string, id uint64) (string, error)
	FindContributionOrigin(ctx context.Context, callUUID string) (ContributionOriginRecord, []ContributionSourceRecord, error)
	CreateProject(ctx context.Context, input CreateProjectRecord) error
	SetContract(ctx context.Context, input SetContractRecord) error
	DeleteProject(ctx context.Context, userID uint64, projectUUID string) (bool, error)
}

type ContractRecord struct {
	ID, CreatedBy                                  uint64
	UUID, Name, Source, Version, Description, Body string
	DeletedAt                                      *time.Time
	CreatedAt                                      time.Time
}

type ContractEventRecord struct {
	ID, ContractID, EventType, SnapshotJSON string
	CreatedAt                               time.Time
}

type CreateContractRecord struct {
	ID, EventID, Name, Description, Body, Snapshot string
	OwnerID                                        uint64
	CreatedAt                                      time.Time
}

type ContractRepository interface {
	CreateCustom(ctx context.Context, input CreateContractRecord) error
	DeleteCustom(ctx context.Context, userID uint64, contractUUID, eventUUID, snapshot string, deletedAt time.Time) error
	ListEvents(ctx context.Context, userID uint64) ([]ContractEventRecord, error)
	ListVisible(ctx context.Context, userID uint64) ([]ContractRecord, error)
	FindVisible(ctx context.Context, userID uint64, contractUUID string) (ContractRecord, error)
}

type NodeRecord struct {
	UUID, RevisionUUID, Title, Stage, OriginalIntent, SmartContractUUID, SmartContractVersion string
	Goal, Criteria, EvidenceRequirement                                                       string
	BranchUUID, ParentUUID, SourceIDs, SupplementUUID, RetryUUID, ActorUserID                 *string
	Claim, Evidence, RecordUUID, DraftReview, DraftAI, ReviewMessages, AIReview               *string
	CompletionAI, ReviewRounds, PlanningUUID, CompletionUUID, Verdict, NextTitle              *string
	StartedAt, EndedAt                                                                        *time.Time
	CreatedAt, UpdatedAt                                                                      time.Time
}

type EdgeRecord struct {
	UUID, SourceUUID, TargetUUID, Type string
	CreatedAt                          time.Time
}

type BranchRecord struct {
	UUID, ProjectUUID, Title                    string
	RootUUID, ForkedUUID, HeadUUID, CurrentUUID *string
	CreatedByUserID                             string
	CreatedAt                                   time.Time
}

type CompletionRecord struct {
	UUID, ProjectUUID, ClosingUUID                                                                                        string
	CoveredIDs, Title, Summary, SmartContractUUID, SmartContractVersion, ReviewID, ReviewVerdict, RecordKind, UserVerdict string
	CreatedAt                                                                                                             time.Time
}

type CreateNodeRecord struct {
	OwnerID                                                                  uint64
	ProjectID, NodeID, Title, Draft, Goal, CriteriaJSON, EvidenceRequirement string
	DraftReviewJSON, DraftAIConfigJSON, MessagesJSON, SourceIDsJSON          string
	ParentID, SupplementID, RetryID, PlanningConversationID, BranchID        string
	EdgeType                                                                 string
	SourceIDs                                                                []string
	Visibility                                                               string
	Fork, Closure, Supplement, CreateBranch                                  bool
}

type LockNodeRecord struct {
	UserID                                                                     uint64
	ProjectID, NodeID, RecordID, ReviewID, ReviewVerdict, Title, Summary       string
	SmartContractVersion, RecordKind, TerminalStage, VerdictJSON, MessagesJSON string
	CoveredIDsJSON                                                             []byte
}

type ExecutionRepository interface {
	CreateNode(ctx context.Context, input CreateNodeRecord) error
	LockNode(ctx context.Context, input LockNodeRecord) error
	ListNodeProjections(ctx context.Context, projectUUID string) ([]NodeRecord, error)
	ListEdgeProjections(ctx context.Context) ([]EdgeRecord, error)
	ListBranchProjections(ctx context.Context, projectUUID string) ([]BranchRecord, error)
	ListCompletionProjections(ctx context.Context, projectUUID string) ([]CompletionRecord, error)
	UUIDByInternalIDs(ctx context.Context, ids []uint64) (map[uint64]string, error)
}
