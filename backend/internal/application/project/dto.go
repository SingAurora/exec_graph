package project

import "time"

// Criterion 是节点或协作目标的一条可验证验收标准。
type Criterion struct {
	ID               string `json:"id"`
	Text             string `json:"text"`
	RequiredEvidence string `json:"requiredEvidence"`
}

// Contract 是智能合约的应用层视图。
type Contract struct {
	ID, Name, Source, Version, Description, Body string
	CreatedAt                                    time.Time
}

// ContractEvent 是智能合约变更事件的应用层视图。
type ContractEvent struct {
	ID, ContractID, EventType string
	Contract                  Contract
	CreatedAt                 time.Time
}

// ContractView 是项目当前使用的智能合约视图。
type ContractView struct {
	ID          string    `json:"uuid"`
	Name        string    `json:"name"`
	Source      string    `json:"source"`
	Version     string    `json:"version"`
	Description string    `json:"description"`
	Body        string    `json:"body"`
	CreatedAt   time.Time `json:"createdAt"`
}

// ProjectRevisionView 是项目智能合约修订版本视图。
type ProjectRevisionView struct {
	ID                   string        `json:"uuid"`
	SmartContractID      string        `json:"smartContractUuid"`
	SmartContractVersion string        `json:"smartContractVersion"`
	Reason               string        `json:"reason"`
	ActivatedAt          time.Time     `json:"activatedAt"`
	SmartContract        *ContractView `json:"smartContract,omitempty"`
}

// ContributionOriginSource 是贡献项目可继承的已完成成果来源。
type ContributionOriginSource struct {
	Title        string `json:"title"`
	ProjectTitle string `json:"projectTitle"`
	MappingText  string `json:"mappingText"`
	Status       string `json:"status"`
}

// ContributionOrigin 是开放缺口交接给贡献者的上下文视图。
type ContributionOrigin struct {
	CallID              string                     `json:"callUuid"`
	ProjectID           string                     `json:"projectUuid"`
	ProjectTitle        string                     `json:"projectTitle"`
	CallTitle           string                     `json:"callTitle"`
	Status              string                     `json:"status"`
	TargetTitle         string                     `json:"targetTitle"`
	VerifiableGoal      string                     `json:"verifiableGoal"`
	AcceptanceCriteria  []Criterion                `json:"acceptanceCriteria"`
	EvidenceRequirement string                     `json:"evidenceRequirement"`
	AvailableSources    []ContributionOriginSource `json:"availableSources"`
}

// ProjectView 是项目详情及其当前执行状态的视图。
type ProjectView struct {
	ID                       string                `json:"uuid"`
	Title                    string                `json:"title"`
	Description              string                `json:"description"`
	ProjectRules             string                `json:"projectRules"`
	IsDefault                bool                  `json:"isDefault"`
	Visibility               string                `json:"visibility"`
	ProjectType              string                `json:"projectType"`
	ReviewAIKeyID            *string               `json:"reviewAIKeyUuid,omitempty"`
	CurrentContractID        *string               `json:"currentContractUuid"`
	ActiveContractRevisionID string                `json:"activeContractRevisionUuid"`
	ContractRevisions        []ProjectRevisionView `json:"contractRevisions"`
	CreatedAt                time.Time             `json:"createdAt"`
	ArchivedAt               *time.Time            `json:"archivedAt,omitempty"`
	ContributionOrigin       *ContributionOrigin   `json:"contributionOrigin,omitempty"`
}

// CreateInput 是创建项目用例的输入，不包含 HTTP 请求或响应类型。
type CreateInput struct {
	OwnerID            uint64
	Title              string
	Description        string
	ProjectType        string
	ProjectRules       string
	SmartContractID    string
	Visibility         string
	AIKeyID            string
	ContributionCallID string
}

// CreateNodeInput 是创建推进节点用例的输入。
type CreateNodeInput struct {
	OwnerID                uint64
	ProjectID              string
	Draft                  string
	DraftReview            any
	DraftReviewVerdict     string
	DraftReviewKeyID       string
	Title                  string
	VerifiableGoal         string
	AcceptanceCriteria     []Criterion
	EvidenceRequirement    string
	ParentContractID       string
	SourceContractIDs      []string
	BranchID               string
	Fork                   bool
	SupplementOfNodeID     string
	RetryOfContractID      string
	Closure                bool
	PlanningConversationID string
}

// CreateNodeResult 是创建推进节点后返回的节点和项目状态。
type CreateNodeResult struct {
	NodeID string
	State  State
}

// ExecutionNodeView 是执行图中的推进节点视图。
type ExecutionNodeView struct {
	ID                        string     `json:"uuid"`
	ProjectID                 string     `json:"projectUuid"`
	BranchID                  *string    `json:"branchUuid,omitempty"`
	ProjectContractRevisionID string     `json:"projectContractRevisionUuid"`
	ParentContractID          *string    `json:"parentContractUuid,omitempty"`
	SourceContractIDs         any        `json:"sourceContractUuids,omitempty"`
	SupplementOfContractID    *string    `json:"supplementOfContractUuid,omitempty"`
	RetryOfContractID         *string    `json:"retryOfContractUuid,omitempty"`
	ActorUserID               *string    `json:"actorUserId,omitempty"`
	Title                     string     `json:"title"`
	Stage                     string     `json:"stage"`
	OriginalIntent            string     `json:"originalIntent"`
	SmartContractID           string     `json:"smartContractUuid"`
	SmartContractVersion      string     `json:"smartContractVersion"`
	VerifiableGoal            string     `json:"verifiableGoal"`
	AcceptanceCriteria        any        `json:"acceptanceCriteria"`
	EvidenceRequirement       string     `json:"evidenceRequirement"`
	CompletionClaim           *string    `json:"completionClaim,omitempty"`
	EvidenceText              *string    `json:"evidenceText,omitempty"`
	StartedAt                 *time.Time `json:"startedAt,omitempty"`
	EndedAt                   *time.Time `json:"endedAt,omitempty"`
	CompletionRecordID        *string    `json:"completionRecordUuid,omitempty"`
	DraftReview               any        `json:"draftReview,omitempty"`
	DraftReviewAIConfig       any        `json:"draftReviewAIConfig,omitempty"`
	ReviewMessages            any        `json:"reviewMessages"`
	AIReview                  any        `json:"aiReview,omitempty"`
	CompletionReviewAIConfig  any        `json:"completionReviewAIConfig,omitempty"`
	CompletionReviewRounds    any        `json:"completionReviewRounds,omitempty"`
	PlanningConversationID    *string    `json:"planningConversationUuid,omitempty"`
	CompletionConversationID  *string    `json:"completionConversationUuid,omitempty"`
	UserVerdict               any        `json:"userVerdict,omitempty"`
	NextContractTitle         *string    `json:"nextContractTitle,omitempty"`
	CreatedAt                 time.Time  `json:"createdAt"`
	UpdatedAt                 time.Time  `json:"updatedAt"`
}

// ExecutionEdgeView 是执行图中的关系边视图。
type ExecutionEdgeView struct {
	ID               string    `json:"uuid"`
	SourceContractID string    `json:"sourceContractUuid"`
	TargetContractID string    `json:"targetContractUuid"`
	Type             string    `json:"type"`
	CreatedAt        time.Time `json:"createdAt"`
}

// ExecutionBranchView 是执行图中的分支路径视图。
type ExecutionBranchView struct {
	ID                   string    `json:"uuid"`
	ProjectID            string    `json:"projectUuid"`
	Title                string    `json:"title"`
	RootContractID       *string   `json:"rootContractUuid,omitempty"`
	ForkedFromContractID *string   `json:"forkedFromContractUuid,omitempty"`
	HeadContractID       *string   `json:"headContractUuid,omitempty"`
	CurrentContractID    *string   `json:"currentContractUuid,omitempty"`
	CreatedByUserID      string    `json:"createdByUserId"`
	CreatedAt            time.Time `json:"createdAt"`
}

// CompletionRecordView 是已完成或已封存成果的视图。
type CompletionRecordView struct {
	ID                   string    `json:"uuid"`
	ProjectID            string    `json:"projectUuid"`
	ClosingContractID    string    `json:"closingContractUuid"`
	CoveredContractIDs   []string  `json:"coveredContractUuids"`
	Title                string    `json:"title"`
	Summary              string    `json:"summary"`
	SmartContractID      string    `json:"smartContractUuid"`
	SmartContractVersion string    `json:"smartContractVersion"`
	ReviewID             string    `json:"reviewUuid"`
	AIReviewVerdict      string    `json:"aiReviewVerdict"`
	RecordKind           string    `json:"recordKind"`
	UserVerdict          any       `json:"userVerdict"`
	CreatedAt            time.Time `json:"createdAt"`
}

// State 是项目详情页使用的完整执行状态。
type State struct {
	Project           ProjectView            `json:"project"`
	Nodes             []ExecutionNodeView    `json:"nodes"`
	Edges             []ExecutionEdgeView    `json:"edges"`
	Branches          []ExecutionBranchView  `json:"branches"`
	CompletionRecords []CompletionRecordView `json:"completionRecords"`
}
