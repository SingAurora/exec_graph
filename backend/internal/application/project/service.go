// Package project contains project lifecycle use cases.
package project

import (
	"context"
	"database/sql"
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
	tx, err := s.execution.Begin(ctx)
	if err != nil {
		return ProjectView{}, err
	}
	defer tx.Rollback()

	var projectInternalID uint64
	var projectType string
	var contributionCallID sql.NullInt64
	err = tx.Row(ctx, `
		SELECT id, project_type, contribution_call_id
		FROM projects WHERE uuid = ? AND owner_id = ? AND archived_at IS NULL FOR UPDATE`, projectID, userID).
		Scan(&projectInternalID, &projectType, &contributionCallID)
	if errors.Is(err, sql.ErrNoRows) {
		return ProjectView{}, ErrNotFound
	}
	if err != nil {
		return ProjectView{}, err
	}
	if projectType != "autonomous" || contributionCallID.Valid {
		return ProjectView{}, ErrInvalidContract
	}

	var contractInternalID uint64
	var name, description, version, body string
	err = tx.Row(ctx, `
		SELECT id, name, description, version, body
		FROM smart_contracts
		WHERE uuid = ? AND deleted_at IS NULL AND (source = 'official' OR (source = 'custom' AND created_by = ?))`, contractID, userID).
		Scan(&contractInternalID, &name, &description, &version, &body)
	if errors.Is(err, sql.ErrNoRows) {
		return ProjectView{}, ErrContractUnavailable
	}
	if err != nil {
		return ProjectView{}, err
	}
	revisionID, err := sharedid.Opaque("project-revision")
	if err != nil {
		return ProjectView{}, err
	}
	result, err := tx.Execute(ctx, `
		INSERT INTO project_contract_revisions
			(uuid, project_id, smart_contract_id, smart_contract_version, reason, smart_contract_name, smart_contract_description, smart_contract_body)
		VALUES (?, ?, ?, ?, '项目设置更换智能合约', ?, ?, ?)`, revisionID, projectInternalID, contractInternalID, version, name, description, body)
	if err != nil {
		return ProjectView{}, err
	}
	revisionInternalID, err := result.LastInsertId()
	if err != nil {
		return ProjectView{}, err
	}
	if _, err := tx.Execute(ctx, `UPDATE projects SET active_contract_revision_id = ? WHERE id = ? AND owner_id = ?`, revisionInternalID, projectInternalID, userID); err != nil {
		return ProjectView{}, err
	}
	if err := tx.Commit(); err != nil {
		return ProjectView{}, err
	}
	return s.Get(ctx, userID, projectID)
}

func (s *Service) Delete(ctx context.Context, userID uint64, projectID string) error {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	tx, err := s.execution.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var internalID uint64
	if err := tx.Row(ctx, `SELECT id FROM projects WHERE uuid = ? AND owner_id = ?`, projectID, userID).Scan(&internalID); errors.Is(err, sql.ErrNoRows) {
		return ErrNotFound
	} else if err != nil {
		return err
	}
	var adopted int
	if err := tx.Row(ctx, `SELECT COUNT(*) FROM collaboration_submissions s JOIN completion_records r ON r.id = s.source_record_id WHERE r.project_id = ? AND s.status = 'adopted'`, internalID).Scan(&adopted); err != nil {
		return err
	}
	if adopted > 0 {
		return ErrAdoptedContent
	}
	statements := []string{
		`DELETE FROM execution_edges WHERE source_contract_id IN (SELECT id FROM execution_contracts WHERE project_id = ?) OR target_contract_id IN (SELECT id FROM execution_contracts WHERE project_id = ?)`,
		`DELETE m FROM node_conversation_messages m JOIN node_conversations c ON c.id = m.conversation_id WHERE c.project_id = ?`,
		`DELETE FROM node_conversations WHERE project_id = ?`,
		`DELETE FROM completion_records WHERE project_id = ?`,
		`DELETE FROM execution_branches WHERE project_id = ?`,
		`DELETE FROM execution_contracts WHERE project_id = ?`,
		`DELETE FROM project_contract_revisions WHERE project_id = ?`,
	}
	for i, statement := range statements {
		args := []any{internalID}
		if i == 0 {
			args = []any{internalID, internalID}
		}
		if _, err := tx.Execute(ctx, statement, args...); err != nil {
			return err
		}
	}
	result, err := tx.Execute(ctx, `DELETE FROM projects WHERE uuid = ? AND owner_id = ?`, projectID, userID)
	if err != nil {
		return err
	}
	count, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if count == 0 {
		return ErrNotFound
	}
	return tx.Commit()
}
