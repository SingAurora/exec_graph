package project

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
	sharedid "github.com/singaurora/exec-graph/backend/internal/shared/id"
)

const (
	generalSmartContractID = "smart-contract-general"
	quickActionContractID  = "smart-contract-quick-action"
	dailyRoutineContractID = "smart-contract-daily-routine"
)

// ListOwnedProjects 返回当前用户的项目摘要。项目详情由同一个领域服务统一组装。
func (s *Service) ListOwnedProjects(ctx context.Context, userID uint64) ([]ProjectView, error) {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	ids, err := s.projects.ListIDsForOwner(ctx, userID)
	if err != nil {
		return nil, err
	}
	projects := make([]ProjectView, 0, len(ids))
	for _, id := range ids {
		item, err := s.GetOwnedProject(ctx, userID, id)
		if err != nil {
			return nil, err
		}
		projects = append(projects, item)
	}
	return projects, nil
}

// GetOwnedProject 返回当前用户拥有的项目资料及其当前合约修订。
func (s *Service) GetOwnedProject(ctx context.Context, userID uint64, projectID string) (ProjectView, error) {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	stored, err := s.projects.FindForOwner(ctx, userID, projectID)
	if errors.Is(err, ErrProjectRecordNotFound) {
		return ProjectView{}, ErrNotFound
	}
	if err != nil {
		return ProjectView{}, err
	}

	item := ProjectView{
		ID: stored.UUID, Title: stored.Title, Description: stored.Description,
		ProjectType: stored.ProjectType, Visibility: stored.Visibility,
		IsDefault: stored.IsDefault, CreatedAt: stored.CreatedAt, ArchivedAt: stored.ArchivedAt,
	}
	if stored.ProjectRules != nil {
		item.ProjectRules = *stored.ProjectRules
	}
	if stored.DefaultAIKeyID != nil {
		value, err := s.projects.UUIDByInternalID(ctx, "ai_api_keys", *stored.DefaultAIKeyID)
		if err != nil {
			return ProjectView{}, err
		}
		item.ReviewAIKeyID = &value
	}
	if stored.CurrentContractID != nil {
		value, err := s.projects.UUIDByInternalID(ctx, "execution_contracts", *stored.CurrentContractID)
		if err != nil {
			return ProjectView{}, err
		}
		item.CurrentContractID = &value
	}
	if stored.ActiveContractRevisionID != nil {
		value, err := s.projects.UUIDByInternalID(ctx, "project_contract_revisions", *stored.ActiveContractRevisionID)
		if err != nil {
			return ProjectView{}, err
		}
		item.ActiveContractRevisionID = value
	}

	if stored.ContributionOriginSnapshotJSON != nil {
		var origin ContributionOrigin
		if json.Unmarshal([]byte(*stored.ContributionOriginSnapshotJSON), &origin) == nil {
			item.ContributionOrigin = &origin
		}
	}
	if item.ContributionOrigin == nil && stored.ContributionCallID != nil {
		callID, err := s.projects.UUIDByInternalID(ctx, "collaboration_calls", *stored.ContributionCallID)
		if err != nil {
			return ProjectView{}, err
		}
		origin, err := s.GetContributionOrigin(ctx, callID)
		if err == nil {
			item.ContributionOrigin = &origin
		} else {
			item.ContributionOrigin = &ContributionOrigin{
				CallID: callID, Status: "closed", ProjectTitle: "原始协作目标已不可用", CallTitle: "已关闭的协作交接",
			}
		}
	}

	revisions, err := s.projects.ListContractRevisions(ctx, projectID)
	if err != nil {
		return ProjectView{}, err
	}
	item.ContractRevisions = make([]ProjectRevisionView, 0, len(revisions))
	for _, revision := range revisions {
		contract := ContractView{
			ID: revision.SmartContractUUID, Name: revision.SmartContractName, Source: revision.SmartContractSource,
			Version: revision.SmartContractVersion, Description: revision.SmartContractDescription,
			Body: revision.SmartContractBody, CreatedAt: revision.SmartContractCreatedAt,
		}
		item.ContractRevisions = append(item.ContractRevisions, ProjectRevisionView{
			ID: revision.UUID, SmartContractID: revision.SmartContractUUID,
			SmartContractVersion: revision.SmartContractVersion, Reason: revision.Reason,
			ActivatedAt: revision.ActivatedAt, SmartContract: &contract,
		})
	}
	return item, nil
}

// CreateProject 创建项目及其第一条合约修订，整个过程在一个事务内完成。
func (s *Service) CreateProject(ctx context.Context, input CreateInput) (ProjectView, error) {
	input.Title = strings.TrimSpace(input.Title)
	input.Description = strings.TrimSpace(input.Description)
	input.ProjectType = strings.TrimSpace(input.ProjectType)
	input.ProjectRules = strings.TrimSpace(input.ProjectRules)
	input.Visibility = strings.TrimSpace(input.Visibility)
	input.SmartContractID = strings.TrimSpace(input.SmartContractID)
	input.AIKeyID = strings.TrimSpace(input.AIKeyID)
	input.ContributionCallID = strings.TrimSpace(input.ContributionCallID)
	if len([]rune(input.Title)) < 2 || len([]rune(input.Title)) > 160 {
		return ProjectView{}, ErrInvalidProject
	}
	if input.Visibility == "" {
		input.Visibility = "private"
	}
	if input.Visibility != "private" && input.Visibility != "public" {
		return ProjectView{}, ErrInvalidProject
	}
	if input.ProjectType == "" {
		input.ProjectType = "guided"
	}
	if input.ProjectType != "guided" && input.ProjectType != "autonomous" {
		return ProjectView{}, ErrInvalidProject
	}
	if input.SmartContractID == "" || input.ProjectType == "guided" || input.ContributionCallID != "" {
		input.SmartContractID = generalSmartContractID
	}
	lightweight := input.SmartContractID == quickActionContractID || input.SmartContractID == dailyRoutineContractID
	if input.ProjectType == "guided" && input.ContributionCallID == "" && !lightweight && len([]rune(input.ProjectRules)) < 12 {
		return ProjectView{}, ErrInvalidProject
	}
	if input.AIKeyID == "" {
		return ProjectView{}, ErrAIKeyUnavailable
	}

	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	projectID, err := sharedid.UUID()
	if err != nil {
		return ProjectView{}, err
	}
	revisionID, err := sharedid.UUID()
	if err != nil {
		return ProjectView{}, err
	}
	if input.ContributionCallID != "" {
		input.Visibility = "public"
		input.ProjectType = "autonomous"
		input.ProjectRules = ""
	}
	var snapshot string
	if input.ContributionCallID != "" {
		origin, err := s.GetContributionOrigin(ctx, input.ContributionCallID)
		if err != nil {
			return ProjectView{}, err
		}
		encoded, err := json.Marshal(origin)
		if err != nil {
			return ProjectView{}, err
		}
		snapshot = string(encoded)
	}
	err = s.projects.CreateProject(ctx, CreateProjectRecord{UUID: projectID, RevisionUUID: revisionID, OwnerID: input.OwnerID, Title: input.Title, Description: input.Description, ProjectType: input.ProjectType, ProjectRules: input.ProjectRules, Visibility: input.Visibility, SmartContractUUID: input.SmartContractID, AIKeyUUID: input.AIKeyID, ContributionCallUUID: input.ContributionCallID, OriginSnapshot: snapshot})
	if errors.Is(err, ErrProjectRecordNotFound) {
		return ProjectView{}, ErrContractUnavailable
	}
	if errors.Is(err, ErrProjectRecordInvalid) {
		return ProjectView{}, ErrCallUnavailable
	}
	if err != nil {
		return ProjectView{}, err
	}
	return s.GetOwnedProject(ctx, input.OwnerID, projectID)
}

// GetContributionOrigin 返回开放缺口交接给贡献者所需的上下文和已有来源。
func (s *Service) GetContributionOrigin(ctx context.Context, callID string) (ContributionOrigin, error) {
	stored, sources, err := s.projects.FindContributionOrigin(ctx, callID)
	if err != nil {
		return ContributionOrigin{}, err
	}
	var origin ContributionOrigin
	origin.CallID, origin.ProjectID, origin.ProjectTitle, origin.CallTitle, origin.Status = stored.CallID, stored.ProjectID, stored.ProjectTitle, stored.CallTitle, stored.Status
	origin.TargetTitle, origin.VerifiableGoal, origin.EvidenceRequirement = stored.TargetTitle, stored.Goal, stored.EvidenceRequirement
	_ = json.Unmarshal([]byte(stored.CriteriaJSON), &origin.AcceptanceCriteria)
	origin.AvailableSources = make([]ContributionOriginSource, 0, len(sources))
	for _, source := range sources {
		origin.AvailableSources = append(origin.AvailableSources, ContributionOriginSource{Title: source.Title, ProjectTitle: source.ProjectTitle, MappingText: source.MappingText, Status: source.Status})
	}
	return origin, nil
}
