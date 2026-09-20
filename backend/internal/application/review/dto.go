package review

import (
	"time"

	applicationaigateway "github.com/singaurora/exec-graph/backend/internal/application/aigateway"
)

type Criterion struct {
	ID               string `json:"id"`
	Text             string `json:"text"`
	RequiredEvidence string `json:"requiredEvidence"`
}

type SmartContract struct {
	ID          string `json:"uuid"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Body        string `json:"body"`
}

type Project struct {
	ID           string `json:"uuid"`
	Title        string `json:"title"`
	Description  string `json:"description"`
	ProjectRules string `json:"projectRules,omitempty"`
}

type Clarification struct {
	ID                         string    `json:"uuid"`
	CriterionIDs               []string  `json:"criterionIds"`
	Explanation                string    `json:"explanation"`
	EvidenceReferences         string    `json:"evidenceReferences,omitempty"`
	EvidenceAddition           string    `json:"evidenceAddition,omitempty"`
	EvidencePredatesSubmission bool      `json:"evidencePredatesSubmission,omitempty"`
	CreatedAt                  time.Time `json:"createdAt"`
}

// ClarificationInput 是用户针对已有审查缺口提交的说明与既有证据。
type ClarificationInput struct {
	NodeID                     string   `json:"nodeUuid"`
	CriterionIDs               []string `json:"criterionIds"`
	Explanation                string   `json:"explanation"`
	EvidenceReferences         string   `json:"evidenceReferences"`
	EvidenceAddition           string   `json:"evidenceAddition"`
	EvidencePredatesSubmission bool     `json:"evidencePredatesSubmission"`
}

type CompletionRequest struct {
	Project             Project        `json:"project"`
	SmartContract       SmartContract  `json:"smartContract"`
	NodeID              string         `json:"nodeUuid"`
	Title               string         `json:"title"`
	OriginalIntent      string         `json:"originalIntent"`
	VerifiableGoal      string         `json:"verifiableGoal"`
	AcceptanceCriteria  []Criterion    `json:"acceptanceCriteria"`
	EvidenceRequirement string         `json:"evidenceRequirement"`
	CompletionClaim     string         `json:"completionClaim"`
	EvidenceText        string         `json:"evidenceText"`
	StartedAt           *time.Time     `json:"startedAt,omitempty"`
	EndedAt             *time.Time     `json:"endedAt,omitempty"`
	PriorReview         *Result        `json:"priorReview,omitempty"`
	Clarification       *Clarification `json:"clarification,omitempty"`
}

type DraftRequest struct {
	Project             Project       `json:"project"`
	SmartContract       SmartContract `json:"smartContract"`
	Draft               string        `json:"draft"`
	Title               string        `json:"title"`
	VerifiableGoal      string        `json:"verifiableGoal"`
	AcceptanceCriteria  []string      `json:"acceptanceCriteria"`
	EvidenceRequirement string        `json:"evidenceRequirement"`
}

type CriterionResult struct {
	CriterionID string `json:"criterionId"`
	Result      string `json:"result"`
	Reason      string `json:"reason"`
}

type AIConfigSnapshot struct {
	KeyID    string `json:"keyUuid"`
	Label    string `json:"label"`
	Provider string `json:"provider"`
	Model    string `json:"model"`
	BaseURL  string `json:"baseUrl"`
}

type Result struct {
	ID                       string            `json:"uuid"`
	Verdict                  string            `json:"verdict"`
	Summary                  string            `json:"summary"`
	CriterionReviews         []CriterionResult `json:"criterionReviews"`
	SuggestedSupplementTitle string            `json:"suggestedSupplementTitle,omitempty"`
	CreatedAt                time.Time         `json:"createdAt"`
	AIConfig                 AIConfigSnapshot  `json:"aiConfig"`
}

// Round 是一次可追溯的完成审查轮次。
type Round struct {
	ID            string           `json:"uuid"`
	Kind          string           `json:"kind"`
	Clarification *Clarification   `json:"clarification,omitempty"`
	Review        Result           `json:"review"`
	AIConfig      AIConfigSnapshot `json:"aiConfig"`
	CreatedAt     time.Time        `json:"createdAt"`
}

// ReviewMessage 是写入节点审查记录的用户或 AI 消息。
type ReviewMessage struct {
	ID        string    `json:"uuid"`
	Speaker   string    `json:"speaker"`
	Body      string    `json:"body"`
	CreatedAt time.Time `json:"createdAt"`
}

type ModelOutput struct {
	Verdict                  string            `json:"verdict"`
	Summary                  string            `json:"summary"`
	CriterionReviews         []CriterionResult `json:"criterionReviews"`
	SuggestedSupplementTitle string            `json:"suggestedSupplementTitle"`
}

type DraftResult struct {
	ID                  string           `json:"uuid"`
	Verdict             string           `json:"verdict"`
	Summary             string           `json:"summary"`
	MissingRequirements []string         `json:"missingRequirements"`
	CreatedAt           time.Time        `json:"createdAt"`
	AIConfig            AIConfigSnapshot `json:"aiConfig"`
}

type DraftModelOutput struct {
	Verdict             string   `json:"verdict"`
	Summary             string   `json:"summary"`
	MissingRequirements []string `json:"missingRequirements"`
}

type ModelConfiguration struct {
	Credential applicationaigateway.Credential
	Snapshot   AIConfigSnapshot
}
