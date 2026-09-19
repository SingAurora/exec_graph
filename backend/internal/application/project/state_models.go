package project

import "time"

type ExecutionNodeView struct {
	ID                        string     `json:"id"`
	ProjectID                 string     `json:"projectId"`
	BranchID                  *string    `json:"branchId,omitempty"`
	ProjectContractRevisionID string     `json:"projectContractRevisionId"`
	ParentContractID          *string    `json:"parentContractId,omitempty"`
	SourceContractIDs         any        `json:"sourceContractIds,omitempty"`
	SupplementOfContractID    *string    `json:"supplementOfContractId,omitempty"`
	RetryOfContractID         *string    `json:"retryOfContractId,omitempty"`
	ActorID                   *uint64    `json:"actorId,omitempty"`
	Title                     string     `json:"title"`
	Stage                     string     `json:"stage"`
	OriginalIntent            string     `json:"originalIntent"`
	SmartContractID           string     `json:"smartContractId"`
	SmartContractVersion      string     `json:"smartContractVersion"`
	VerifiableGoal            string     `json:"verifiableGoal"`
	AcceptanceCriteria        any        `json:"acceptanceCriteria"`
	EvidenceRequirement       string     `json:"evidenceRequirement"`
	CompletionClaim           *string    `json:"completionClaim,omitempty"`
	EvidenceText              *string    `json:"evidenceText,omitempty"`
	StartedAt                 *time.Time `json:"startedAt,omitempty"`
	EndedAt                   *time.Time `json:"endedAt,omitempty"`
	CompletionRecordID        *string    `json:"completionRecordId,omitempty"`
	DraftReview               any        `json:"draftReview,omitempty"`
	DraftReviewAIConfig       any        `json:"draftReviewAIConfig,omitempty"`
	ReviewMessages            any        `json:"reviewMessages"`
	AIReview                  any        `json:"aiReview,omitempty"`
	CompletionReviewAIConfig  any        `json:"completionReviewAIConfig,omitempty"`
	CompletionReviewRounds    any        `json:"completionReviewRounds,omitempty"`
	PlanningConversationID    *string    `json:"planningConversationId,omitempty"`
	CompletionConversationID  *string    `json:"completionConversationId,omitempty"`
	UserVerdict               any        `json:"userVerdict,omitempty"`
	NextContractTitle         *string    `json:"nextContractTitle,omitempty"`
	CreatedAt                 time.Time  `json:"createdAt"`
	UpdatedAt                 time.Time  `json:"updatedAt"`
}

type ExecutionEdgeView struct {
	ID               string    `json:"id"`
	SourceContractID string    `json:"sourceContractId"`
	TargetContractID string    `json:"targetContractId"`
	Type             string    `json:"type"`
	CreatedAt        time.Time `json:"createdAt"`
}

type ExecutionBranchView struct {
	ID                   string    `json:"id"`
	ProjectID            string    `json:"projectId"`
	Title                string    `json:"title"`
	RootContractID       *string   `json:"rootContractId,omitempty"`
	ForkedFromContractID *string   `json:"forkedFromContractId,omitempty"`
	HeadContractID       *string   `json:"headContractId,omitempty"`
	CurrentContractID    *string   `json:"currentContractId,omitempty"`
	CreatedByID          uint64    `json:"createdById"`
	CreatedAt            time.Time `json:"createdAt"`
}

type CompletionRecordView struct {
	ID                   string    `json:"id"`
	ProjectID            string    `json:"projectId"`
	ClosingContractID    string    `json:"closingContractId"`
	CoveredContractIDs   []string  `json:"coveredContractIds"`
	Title                string    `json:"title"`
	Summary              string    `json:"summary"`
	SmartContractID      string    `json:"smartContractId"`
	SmartContractVersion string    `json:"smartContractVersion"`
	ReviewID             string    `json:"reviewId"`
	AIReviewVerdict      string    `json:"aiReviewVerdict"`
	RecordKind           string    `json:"recordKind"`
	UserVerdict          any       `json:"userVerdict"`
	CreatedAt            time.Time `json:"createdAt"`
}

type State struct {
	Project           ProjectView            `json:"project"`
	Nodes             []ExecutionNodeView    `json:"nodes"`
	Edges             []ExecutionEdgeView    `json:"edges"`
	Branches          []ExecutionBranchView  `json:"branches"`
	CompletionRecords []CompletionRecordView `json:"completionRecords"`
}
