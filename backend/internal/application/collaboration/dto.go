package collaboration

import "time"

// Target 是公开协作征集所指向的项目节点视图。
type Target struct {
	ID                  string      `json:"id"`
	Title               string      `json:"title"`
	VerifiableGoal      string      `json:"verifiableGoal"`
	AcceptanceCriteria  []Criterion `json:"acceptanceCriteria"`
	EvidenceRequirement string      `json:"evidenceRequirement"`
	Stage               string      `json:"stage"`
}

// Criterion 是协作目标的一条可验证验收标准。
type Criterion struct {
	ID               string `json:"id"`
	Text             string `json:"text"`
	RequiredEvidence string `json:"requiredEvidence"`
}

// Call 是一个公开协作征集视图。
type Call struct {
	ID              string    `json:"id"`
	ProjectID       string    `json:"projectId"`
	ProjectTitle    string    `json:"projectTitle"`
	OwnerName       string    `json:"ownerName"`
	OwnerUserID     string    `json:"ownerUserId"`
	CreatedBy       uint64    `json:"createdBy"`
	Title           string    `json:"title"`
	Status          string    `json:"status"`
	MaxSubmissions  int       `json:"maxSubmissions"`
	SubmissionCount int       `json:"submissionCount"`
	Target          Target    `json:"target"`
	CreatedAt       time.Time `json:"createdAt"`
}

// ExploreProject 是探索页使用的公开项目摘要。
type ExploreProject struct {
	ID            string `json:"id"`
	Title         string `json:"title"`
	Description   string `json:"description"`
	OwnerName     string `json:"ownerName"`
	OwnerUserID   string `json:"ownerUserId"`
	NodeCount     int    `json:"nodeCount"`
	AcceptedCount int    `json:"acceptedCount"`
	OpenCallCount int    `json:"openCallCount"`
	Calls         []Call `json:"calls"`
}

// Submission 是贡献者提交给协作征集的成果视图。
type Submission struct {
	ID                 string    `json:"id"`
	CallID             string    `json:"callId"`
	SourceRecordID     string    `json:"sourceRecordId"`
	SourceTitle        string    `json:"sourceTitle"`
	SourceSummary      string    `json:"sourceSummary"`
	SourceProjectTitle string    `json:"sourceProjectTitle"`
	ContributorID      uint64    `json:"contributorId"`
	ContributorName    string    `json:"contributorName"`
	ContributorUserID  string    `json:"contributorUserId"`
	MappingText        string    `json:"mappingText"`
	Note               string    `json:"note,omitempty"`
	Status             string    `json:"status"`
	CreatedAt          time.Time `json:"createdAt"`
}

// CallDetails 是协作征集及其投稿的完整视图。
type CallDetails struct {
	Call        Call         `json:"call"`
	Submissions []Submission `json:"submissions"`
}

// CreateCallInput 是创建协作征集用例的输入。
type CreateCallInput struct {
	OwnerID          uint64
	ProjectID        string
	TargetContractID string
	Title            string
	MaxSubmissions   int
}

// SubmitInput 是提交已有成果参与协作征集用例的输入。
type SubmitInput struct {
	UserID         uint64
	CallID         string
	SourceRecordID string
	MappingText    string
	Note           string
}

// ReviewContext 是组合审查所需的项目、节点和规则上下文。
type ReviewContext struct {
	ProjectTitle       string
	ProjectDescription string
	ProjectRules       string
	OriginalIntent     string
	SmartContractID    string
	SmartContractName  string
	SmartContractDesc  string
	SmartContractBody  string
}

// CreateReviewBatchInput 是保存一次 AI 组合审查的输入。
type CreateReviewBatchInput struct {
	UserID        uint64
	BatchID       string
	CallID        string
	SubmissionIDs []string
	ReviewJSON    string
	Status        string
}

// AdoptReviewInput 是采纳一批已通过审查投稿的输入。
type AdoptReviewInput struct {
	UserID  uint64
	BatchID string
}

type ContributionSource struct {
	ID           string `json:"id"`
	Title        string `json:"title"`
	Summary      string `json:"summary"`
	ProjectTitle string `json:"projectTitle"`
}

type ContributionActivity struct {
	Submission Submission `json:"submission"`
	Call       Call       `json:"call"`
}
