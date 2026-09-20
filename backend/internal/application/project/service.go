// Package project contains project lifecycle use cases.
package project

import (
	"context"
	"errors"

	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
	sharedid "github.com/singaurora/exec-graph/backend/internal/shared/id"
)

type Service struct {
	projects  ProjectRepository
	contracts ContractRepository
	execution ExecutionRepository
}

func New(projects ProjectRepository, contracts ContractRepository, execution ExecutionRepository) *Service {
	return &Service{projects: projects, contracts: contracts, execution: execution}
}

// UpdateProjectProfile 更新项目名称、说明和可见性。
func (s *Service) UpdateProjectProfile(ctx context.Context, userID uint64, projectID, title, description, visibility string) error {
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

// ArchiveProject 停止项目继续推进，同时保留历史数据。
func (s *Service) ArchiveProject(ctx context.Context, userID uint64, projectID string) error {
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

// RestoreArchivedProject 恢复一个已归档项目。
func (s *Service) RestoreArchivedProject(ctx context.Context, userID uint64, projectID string) error {
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

// SetProjectReviewAI 设置项目后续审查使用的 AI 密钥。
func (s *Service) SetProjectReviewAI(ctx context.Context, userID uint64, projectID, keyID string) error {
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

// SetProjectSmartContract 为自主项目创建一条新的项目合约修订。
func (s *Service) SetProjectSmartContract(ctx context.Context, userID uint64, projectID, contractID string) (ProjectView, error) {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	revisionID, err := sharedid.UUID()
	if err != nil {
		return ProjectView{}, err
	}
	err = s.projects.SetContract(ctx, SetContractRecord{ProjectUUID: projectID, ContractUUID: contractID, RevisionUUID: revisionID, OwnerID: userID})
	if errors.Is(err, ErrProjectRecordNotFound) {
		return ProjectView{}, ErrNotFound
	}
	if errors.Is(err, ErrProjectRecordInvalid) {
		return ProjectView{}, ErrInvalidContract
	}
	if err != nil {
		return ProjectView{}, err
	}
	return s.GetOwnedProject(ctx, userID, projectID)
}

// DeleteProject 删除没有外部采纳关系的项目及其执行数据。
func (s *Service) DeleteProject(ctx context.Context, userID uint64, projectID string) error {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	deleted, err := s.projects.DeleteProject(ctx, userID, projectID)
	if errors.Is(err, ErrProjectRecordNotFound) {
		return ErrNotFound
	}
	if errors.Is(err, ErrProjectRecordAdopted) {
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
