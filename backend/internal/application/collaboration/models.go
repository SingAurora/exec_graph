package collaboration

import "time"

type Target struct {
	ID                  string      `json:"id"`
	Title               string      `json:"title"`
	VerifiableGoal      string      `json:"verifiableGoal"`
	AcceptanceCriteria  []Criterion `json:"acceptanceCriteria"`
	EvidenceRequirement string      `json:"evidenceRequirement"`
	Stage               string      `json:"stage"`
}

type Criterion struct {
	ID               string `json:"id"`
	Text             string `json:"text"`
	RequiredEvidence string `json:"requiredEvidence"`
}

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

type CallDetails struct {
	Call        Call         `json:"call"`
	Submissions []Submission `json:"submissions"`
}

type CreateCallInput struct {
	OwnerID          uint64
	ProjectID        string
	TargetContractID string
	Title            string
	MaxSubmissions   int
}

type SubmitInput struct {
	UserID         uint64
	CallID         string
	SourceRecordID string
	MappingText    string
	Note           string
}
