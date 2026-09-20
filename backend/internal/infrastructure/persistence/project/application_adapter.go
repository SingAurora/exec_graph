package project

import (
	"context"
	"errors"

	applicationproject "github.com/singaurora/exec-graph/backend/internal/application/project"
)

// ApplicationRepository adapts MySQL project records to the application port.
type ApplicationRepository struct{ repository ProjectRepository }

func NewApplicationRepository(repository ProjectRepository) ApplicationRepository {
	return ApplicationRepository{repository: repository}
}

func (adapter ApplicationRepository) ListIDsForOwner(ctx context.Context, userID uint64) ([]string, error) {
	return adapter.repository.ListIDsForOwner(ctx, userID)
}

func (adapter ApplicationRepository) FindForOwner(ctx context.Context, userID uint64, projectUUID string) (applicationproject.ProjectRecord, error) {
	value, err := adapter.repository.FindForOwner(ctx, userID, projectUUID)
	if err != nil {
		return applicationproject.ProjectRecord{}, mapApplicationError(err)
	}
	return applicationproject.ProjectRecord{
		ID: value.ID, OwnerID: value.OwnerID, UUID: value.UUID, Title: value.Title, Description: value.Description,
		ProjectType: value.ProjectType, ProjectRules: value.ProjectRules, IsDefault: value.IsDefault, Visibility: value.Visibility,
		DefaultAIKeyID: value.DefaultAIKeyID, ContributionCallID: value.ContributionCallID,
		ContributionOriginSnapshotJSON: value.ContributionOriginSnapshotJSON, CurrentContractID: value.CurrentContractID,
		ActiveContractRevisionID: value.ActiveContractRevisionID, CreatedAt: value.CreatedAt, ArchivedAt: value.ArchivedAt,
	}, nil
}

func (adapter ApplicationRepository) HasAdoptedContributions(ctx context.Context, projectUUID string) (bool, error) {
	return adapter.repository.HasAdoptedContributions(ctx, projectUUID)
}

func (adapter ApplicationRepository) UpdateActive(ctx context.Context, userID uint64, projectUUID, title, description, visibility string) (bool, error) {
	return adapter.repository.UpdateActive(ctx, userID, projectUUID, title, description, visibility)
}

func (adapter ApplicationRepository) Archive(ctx context.Context, userID uint64, projectUUID string) (bool, error) {
	return adapter.repository.Archive(ctx, userID, projectUUID)
}

func (adapter ApplicationRepository) Unarchive(ctx context.Context, userID uint64, projectUUID string) (bool, error) {
	return adapter.repository.Unarchive(ctx, userID, projectUUID)
}

func (adapter ApplicationRepository) SetAIKey(ctx context.Context, userID uint64, projectUUID, keyUUID string) (bool, error) {
	return adapter.repository.SetAIKey(ctx, userID, projectUUID, keyUUID)
}

func (adapter ApplicationRepository) ListContractRevisions(ctx context.Context, projectUUID string) ([]applicationproject.ProjectContractRevisionRecord, error) {
	values, err := adapter.repository.ListContractRevisions(ctx, projectUUID)
	if err != nil {
		return nil, err
	}
	result := make([]applicationproject.ProjectContractRevisionRecord, 0, len(values))
	for _, value := range values {
		result = append(result, applicationproject.ProjectContractRevisionRecord{
			ID: value.ID, ProjectID: value.ProjectID, SmartContractID: value.SmartContractID,
			UUID: value.UUID, SmartContractUUID: value.SmartContractUUID, SmartContractVersion: value.SmartContractVersion,
			Reason: value.Reason, ActivatedAt: value.ActivatedAt, SmartContractName: value.SmartContractName,
			SmartContractDescription: value.SmartContractDescription, SmartContractBody: value.SmartContractBody,
			SmartContractSource: value.SmartContractSource, SmartContractCreatedAt: value.SmartContractCreatedAt,
		})
	}
	return result, nil
}

func (adapter ApplicationRepository) UUIDByInternalID(ctx context.Context, table string, id uint64) (string, error) {
	return adapter.repository.UUIDByInternalID(ctx, table, id)
}

func (adapter ApplicationRepository) FindContributionOrigin(ctx context.Context, callUUID string) (applicationproject.ContributionOriginRecord, []applicationproject.ContributionSourceRecord, error) {
	origin, sources, err := adapter.repository.FindContributionOrigin(ctx, callUUID)
	if err != nil {
		return applicationproject.ContributionOriginRecord{}, nil, mapApplicationError(err)
	}
	result := applicationproject.ContributionOriginRecord{
		CallID: origin.CallID, ProjectID: origin.ProjectID, ProjectTitle: origin.ProjectTitle, CallTitle: origin.CallTitle,
		Status: origin.Status, TargetTitle: origin.TargetTitle, Goal: origin.Goal, CriteriaJSON: origin.CriteriaJSON,
		EvidenceRequirement: origin.EvidenceRequirement,
	}
	mappedSources := make([]applicationproject.ContributionSourceRecord, 0, len(sources))
	for _, source := range sources {
		mappedSources = append(mappedSources, applicationproject.ContributionSourceRecord{Title: source.Title, ProjectTitle: source.ProjectTitle, MappingText: source.MappingText, Status: source.Status})
	}
	return result, mappedSources, nil
}

func (adapter ApplicationRepository) CreateProject(ctx context.Context, input applicationproject.CreateProjectRecord) error {
	err := adapter.repository.CreateProject(ctx, CreateProjectInput{
		UUID: input.UUID, RevisionUUID: input.RevisionUUID, OwnerID: input.OwnerID, Title: input.Title,
		Description: input.Description, ProjectType: input.ProjectType, ProjectRules: input.ProjectRules,
		Visibility: input.Visibility, SmartContractUUID: input.SmartContractUUID, AIKeyUUID: input.AIKeyUUID,
		ContributionCallUUID: input.ContributionCallUUID, OriginSnapshot: input.OriginSnapshot,
	})
	return mapApplicationError(err)
}

func (adapter ApplicationRepository) SetContract(ctx context.Context, input applicationproject.SetContractRecord) error {
	return mapApplicationError(adapter.repository.SetContract(ctx, SetContractInput{ProjectID: input.ProjectUUID, ContractID: input.ContractUUID, RevisionUUID: input.RevisionUUID, OwnerID: input.OwnerID}))
}

func (adapter ApplicationRepository) DeleteProject(ctx context.Context, userID uint64, projectUUID string) (bool, error) {
	deleted, err := adapter.repository.DeleteProject(ctx, userID, projectUUID)
	return deleted, mapApplicationError(err)
}

func mapApplicationError(err error) error {
	switch {
	case errors.Is(err, ErrNotFound):
		return applicationproject.ErrProjectRecordNotFound
	case errors.Is(err, ErrInvalid):
		return applicationproject.ErrProjectRecordInvalid
	case errors.Is(err, ErrAdopted):
		return applicationproject.ErrProjectRecordAdopted
	default:
		return err
	}
}
