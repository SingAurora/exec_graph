package project

import "time"

// Criterion 是节点或协作目标的一条可验证验收标准。
type Criterion struct {
	ID               string `json:"id"`
	Text             string `json:"text"`
	RequiredEvidence string `json:"requiredEvidence"`
}

type ContractView struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Source      string    `json:"source"`
	Version     string    `json:"version"`
	Description string    `json:"description"`
	Body        string    `json:"body"`
	CreatedAt   time.Time `json:"createdAt"`
}

type ProjectRevisionView struct {
	ID                   string        `json:"id"`
	SmartContractID      string        `json:"smartContractId"`
	SmartContractVersion string        `json:"smartContractVersion"`
	Reason               string        `json:"reason"`
	ActivatedAt          time.Time     `json:"activatedAt"`
	SmartContract        *ContractView `json:"smartContract,omitempty"`
}

type ContributionOriginSource struct {
	Title        string `json:"title"`
	ProjectTitle string `json:"projectTitle"`
	MappingText  string `json:"mappingText"`
	Status       string `json:"status"`
}

type ContributionOrigin struct {
	CallID              string                     `json:"callId"`
	ProjectID           string                     `json:"projectId"`
	ProjectTitle        string                     `json:"projectTitle"`
	CallTitle           string                     `json:"callTitle"`
	Status              string                     `json:"status"`
	TargetTitle         string                     `json:"targetTitle"`
	VerifiableGoal      string                     `json:"verifiableGoal"`
	AcceptanceCriteria  []Criterion                `json:"acceptanceCriteria"`
	EvidenceRequirement string                     `json:"evidenceRequirement"`
	AvailableSources    []ContributionOriginSource `json:"availableSources"`
}

type ProjectView struct {
	ID                       string                `json:"id"`
	Title                    string                `json:"title"`
	Description              string                `json:"description"`
	ProjectRules             string                `json:"projectRules"`
	IsDefault                bool                  `json:"isDefault"`
	Visibility               string                `json:"visibility"`
	ProjectType              string                `json:"projectType"`
	ReviewAIKeyID            *string               `json:"reviewAIKeyId,omitempty"`
	CurrentContractID        *string               `json:"currentContractId"`
	ActiveContractRevisionID string                `json:"activeContractRevisionId"`
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
