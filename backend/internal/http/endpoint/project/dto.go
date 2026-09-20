package project

import (
	"time"

	applicationproject "github.com/singaurora/exec-graph/backend/internal/application/project"
)

type createProjectRequest struct {
	Title                string `json:"title"`
	Description          string `json:"description"`
	ProjectType          string `json:"projectType"`
	ProjectRules         string `json:"projectRules"`
	SmartContractUUID    string `json:"smartContractUuid"`
	Visibility           string `json:"visibility"`
	AIKeyUUID            string `json:"aiKeyUuid"`
	ContributionCallUUID string `json:"contributionCallUuid"`
}

type updateProjectRequest struct {
	ProjectUUID string `json:"projectUuid"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Visibility  string `json:"visibility"`
}

type setAIKeyRequest struct {
	ProjectUUID string `json:"projectUuid"`
	AIKeyUUID   string `json:"aiKeyUuid"`
}

type setSmartContractRequest struct {
	ProjectUUID       string `json:"projectUuid"`
	SmartContractUUID string `json:"smartContractUuid"`
}

type projectCommandRequest struct {
	ProjectUUID string `json:"projectUuid"`
}

type createSmartContractRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Body        string `json:"body"`
}

type deleteSmartContractRequest struct {
	ContractUUID string `json:"contractUuid"`
}

type contractResponse = applicationproject.ContractView

type contractEventResponse struct {
	ID            string           `json:"uuid"`
	ContractID    string           `json:"contractUuid"`
	EventType     string           `json:"eventType"`
	SmartContract contractResponse `json:"smartContract"`
	CreatedAt     time.Time        `json:"createdAt"`
}

func toContractResponse(contract applicationproject.Contract) contractResponse {
	return contractResponse{
		ID:          contract.ID,
		Name:        contract.Name,
		Source:      contract.Source,
		Version:     contract.Version,
		Description: contract.Description,
		Body:        contract.Body,
		CreatedAt:   contract.CreatedAt,
	}
}
