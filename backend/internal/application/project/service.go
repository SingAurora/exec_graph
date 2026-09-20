// Package project contains project lifecycle use cases.
package project

import (
	"context"
	"errors"

	contractpersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/contract"
	executionpersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/execution"
	projectpersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/project"
	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
	sharedid "github.com/singaurora/exec-graph/backend/internal/shared/id"
)

type Service struct {
	projects  projectpersistence.ProjectRepository
	contracts contractpersistence.SmartContractRepository
	execution *executionpersistence.Repository
}

func New(projects projectpersistence.ProjectRepository, contracts contractpersistence.SmartContractRepository, execution *executionpersistence.Repository) *Service {
	return &Service{projects: projects, contracts: contracts, execution: execution}
}

func (s *Service) Update(ctx context.Context, userID uint64, projectID, title, description, visibility string) error {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	if visibility == "private" {
		adopted, err := s.projects.HasAdoptedContributions(ctx, projectID)
		if err != nil {
			return err
		}
		if adopted {
			return ErrAdoptedContent
		}
	}
	updated, err := s.projects.UpdateActive(ctx, userID, projectID, title, description, visibility)
	if err != nil {
		return err
	}
	if !updated {
		return ErrNotFound
	}
	return nil
}

func (s *Service) Archive(ctx context.Context, userID uint64, projectID string) error {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	archived, err := s.projects.Archive(ctx, userID, projectID)
	if err != nil {
		return err
	}
	if !archived {
		return ErrAlreadyArchived
	}
	return nil
}

func (s *Service) Unarchive(ctx context.Context, userID uint64, projectID string) error {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	restored, err := s.projects.Unarchive(ctx, userID, projectID)
	if err != nil {
		return err
	}
	if !restored {
		return ErrNotArchived
	}
	return nil
}

func (s *Service) SetAIKey(ctx context.Context, userID uint64, projectID, keyID string) error {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	updated, err := s.projects.SetAIKey(ctx, userID, projectID, keyID)
	if err != nil {
		return err
	}
	if !updated {
		return ErrAIKeyUnavailable
	}
	return nil
}

// SetContract 为自主项目创建一条新的项目合约修订。
func (s *Service) SetContract(ctx context.Context, userID uint64, projectID, contractID string) (ProjectView, error) {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	revisionID, err := sharedid.Opaque("project-revision")
	if err != nil {
		return ProjectView{}, err
	}
	err = s.projects.SetContract(ctx, projectpersistence.SetContractInput{ProjectID: projectID, ContractID: contractID, RevisionUUID: revisionID, OwnerID: userID})
	if errors.Is(err, projectpersistence.ErrNotFound) {
		return ProjectView{}, ErrNotFound
	}
	if errors.Is(err, projectpersistence.ErrInvalid) {
		return ProjectView{}, ErrInvalidContract
	}
	if err != nil {
		return ProjectView{}, err
	}
	return s.Get(ctx, userID, projectID)
}

func (s *Service) Delete(ctx context.Context, userID uint64, projectID string) error {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	deleted, err := s.projects.DeleteProject(ctx, userID, projectID)
	if errors.Is(err, projectpersistence.ErrNotFound) {
		return ErrNotFound
	}
	if errors.Is(err, projectpersistence.ErrAdopted) {
		return ErrAdoptedContent
	}
	if err != nil {
		return err
	}
	if !deleted {
		return ErrNotFound
	}
	return nil
}
