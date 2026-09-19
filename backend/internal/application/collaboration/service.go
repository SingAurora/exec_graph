package collaboration

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strings"

	collaborationpersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/collaboration"
	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
	sharedid "github.com/singaurora/exec-graph/backend/internal/shared/id"
)

var (
	ErrNotFound            = errors.New("collaboration resource not found")
	ErrInvalidRequest      = errors.New("invalid collaboration request")
	ErrProjectPrivate      = errors.New("project is private")
	ErrTargetNotReady      = errors.New("target is not ready")
	ErrCallExists          = errors.New("open call already exists")
	ErrSubmissionInvalid   = errors.New("invalid submission")
	ErrDuplicateSubmission = errors.New("duplicate submission")
)

type Service struct {
	repository *collaborationpersistence.Repository
}

type queryer interface {
	Row(context.Context, string, ...any) *sql.Row
}

func New(repository *collaborationpersistence.Repository) *Service {
	return &Service{repository: repository}
}

func (s *Service) CreateCall(ctx context.Context, input CreateCallInput) (Call, error) {
	input.TargetContractID = strings.TrimSpace(input.TargetContractID)
	input.Title = strings.TrimSpace(input.Title)
	if input.TargetContractID == "" {
		return Call{}, ErrInvalidRequest
	}
	if input.MaxSubmissions <= 0 {
		input.MaxSubmissions = 10
	}
	if input.MaxSubmissions > 30 {
		return Call{}, ErrInvalidRequest
	}
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	var projectInternalID, targetInternalID uint64
	var targetTitle, stage, visibility string
	err := s.repository.Row(ctx, `SELECT p.id, n.id, n.title, n.stage, p.visibility FROM execution_contracts n JOIN projects p ON p.id = n.project_id WHERE n.uuid = ? AND p.uuid = ? AND p.owner_id = ? AND p.archived_at IS NULL`, input.TargetContractID, input.ProjectID, input.OwnerID).Scan(&projectInternalID, &targetInternalID, &targetTitle, &stage, &visibility)
	if errors.Is(err, sql.ErrNoRows) {
		return Call{}, ErrNotFound
	}
	if err != nil {
		return Call{}, err
	}
	if visibility != "public" {
		return Call{}, ErrProjectPrivate
	}
	if stage != "frozen" {
		return Call{}, ErrTargetNotReady
	}
	if input.Title == "" {
		input.Title = targetTitle
	}
	var exists bool
	if err := s.repository.Row(ctx, `SELECT EXISTS(SELECT 1 FROM collaboration_calls WHERE project_id = ? AND target_contract_id = ? AND status = 'open')`, projectInternalID, targetInternalID).Scan(&exists); err != nil {
		return Call{}, err
	}
	if exists {
		return Call{}, ErrCallExists
	}
	id, err := sharedid.Opaque("call")
	if err != nil {
		return Call{}, err
	}
	if _, err := s.repository.Execute(ctx, `INSERT INTO collaboration_calls (uuid, project_id, target_contract_id, created_by, title, max_submissions) VALUES (?, ?, ?, ?, ?, ?)`, id, projectInternalID, targetInternalID, input.OwnerID, input.Title, input.MaxSubmissions); err != nil {
		return Call{}, err
	}
	return s.GetCall(ctx, id)
}

func (s *Service) ListExplore(ctx context.Context) ([]ExploreProject, error) {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	rows, err := s.repository.Rows(ctx, `
		SELECT p.uuid, p.title, p.description, u.username, u.user_id,
		       (SELECT COUNT(*) FROM execution_contracts n WHERE n.project_id = p.id),
		       (SELECT COUNT(*) FROM completion_records r WHERE r.project_id = p.id AND r.record_kind = 'accepted'),
		       (SELECT COUNT(*) FROM collaboration_calls c WHERE c.project_id = p.id AND c.status = 'open')
		FROM projects p JOIN users u ON u.id = p.owner_id
		WHERE p.visibility = 'public' AND p.archived_at IS NULL
		ORDER BY (SELECT COUNT(*) FROM collaboration_calls c WHERE c.project_id = p.id AND c.status = 'open') DESC, p.updated_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	projects := make([]ExploreProject, 0)
	for rows.Next() {
		var item ExploreProject
		if err := rows.Scan(&item.ID, &item.Title, &item.Description, &item.OwnerName, &item.OwnerUserID, &item.NodeCount, &item.AcceptedCount, &item.OpenCallCount); err != nil {
			return nil, err
		}
		item.Calls, err = s.ListCalls(ctx, item.ID)
		if err != nil {
			return nil, err
		}
		projects = append(projects, item)
	}
	return projects, rows.Err()
}

func (s *Service) GetProject(ctx context.Context, projectID string) (ExploreProject, error) {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	var item ExploreProject
	err := s.repository.Row(ctx, `
		SELECT p.uuid, p.title, p.description, u.username, u.user_id,
		       (SELECT COUNT(*) FROM execution_contracts n WHERE n.project_id = p.id),
		       (SELECT COUNT(*) FROM completion_records r WHERE r.project_id = p.id AND r.record_kind = 'accepted'),
		       (SELECT COUNT(*) FROM collaboration_calls c WHERE c.project_id = p.id AND c.status = 'open')
		FROM projects p JOIN users u ON u.id = p.owner_id WHERE p.uuid = ? AND p.visibility = 'public' AND p.archived_at IS NULL`, projectID).
		Scan(&item.ID, &item.Title, &item.Description, &item.OwnerName, &item.OwnerUserID, &item.NodeCount, &item.AcceptedCount, &item.OpenCallCount)
	if errors.Is(err, sql.ErrNoRows) {
		return ExploreProject{}, ErrNotFound
	}
	if err != nil {
		return ExploreProject{}, err
	}
	item.Calls, err = s.ListCalls(ctx, item.ID)
	return item, err
}

func (s *Service) ListCalls(ctx context.Context, projectID string) ([]Call, error) {
	rows, err := s.repository.Rows(ctx, `SELECT c.uuid FROM collaboration_calls c JOIN projects p ON p.id = c.project_id WHERE p.uuid = ? ORDER BY c.status = 'open' DESC, c.created_at DESC`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make([]Call, 0)
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		call, err := s.GetCall(ctx, id)
		if err != nil {
			return nil, err
		}
		result = append(result, call)
	}
	return result, rows.Err()
}

func (s *Service) GetCall(ctx context.Context, id string) (Call, error) {
	var call Call
	var criteriaJSON string
	err := s.repository.Row(ctx, `
		SELECT c.uuid, p.uuid, p.title, u.username, u.user_id, c.created_by, c.title, c.status, c.max_submissions, c.created_at,
		       n.uuid, n.title, n.verifiable_goal, n.acceptance_criteria_json, n.evidence_requirement, n.stage,
		       (SELECT COUNT(*) FROM collaboration_submissions s WHERE s.call_id = c.id AND s.status <> 'withdrawn')
		FROM collaboration_calls c JOIN projects p ON p.id = c.project_id JOIN users u ON u.id = p.owner_id
		JOIN execution_contracts n ON n.id = c.target_contract_id WHERE c.uuid = ?`, id).
		Scan(&call.ID, &call.ProjectID, &call.ProjectTitle, &call.OwnerName, &call.OwnerUserID, &call.CreatedBy, &call.Title, &call.Status, &call.MaxSubmissions, &call.CreatedAt,
			&call.Target.ID, &call.Target.Title, &call.Target.VerifiableGoal, &criteriaJSON, &call.Target.EvidenceRequirement, &call.Target.Stage, &call.SubmissionCount)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Call{}, ErrNotFound
		}
		return Call{}, err
	}
	_ = json.Unmarshal([]byte(criteriaJSON), &call.Target.AcceptanceCriteria)
	return call, nil
}

func (s *Service) GetCallDetails(ctx context.Context, id string) (CallDetails, error) {
	call, err := s.GetCall(ctx, id)
	if err != nil {
		return CallDetails{}, err
	}
	items, err := s.listSubmissions(ctx, id)
	if err != nil {
		return CallDetails{}, err
	}
	return CallDetails{Call: call, Submissions: items}, nil
}

func (s *Service) Submit(ctx context.Context, input SubmitInput) (CallDetails, error) {
	input.CallID = strings.TrimSpace(input.CallID)
	input.SourceRecordID = strings.TrimSpace(input.SourceRecordID)
	input.MappingText = strings.TrimSpace(input.MappingText)
	input.Note = strings.TrimSpace(input.Note)
	if input.SourceRecordID == "" || len([]rune(input.MappingText)) < 8 {
		return CallDetails{}, ErrSubmissionInvalid
	}
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	call, err := s.GetCall(ctx, input.CallID)
	if err != nil {
		return CallDetails{}, err
	}
	if call.Status != "open" || call.Target.Stage != "frozen" || call.SubmissionCount >= call.MaxSubmissions {
		return CallDetails{}, ErrSubmissionInvalid
	}
	var sourceOwner uint64
	err = s.repository.Row(ctx, `
		SELECT n.actor_id FROM completion_records r
		JOIN projects p ON p.id = r.project_id
		JOIN execution_contracts n ON n.id = r.closing_contract_id
		WHERE r.uuid = ? AND r.record_kind = 'accepted' AND p.visibility = 'public'`, input.SourceRecordID).Scan(&sourceOwner)
	if errors.Is(err, sql.ErrNoRows) || sourceOwner != input.UserID {
		return CallDetails{}, ErrSubmissionInvalid
	}
	if err != nil {
		return CallDetails{}, err
	}
	callInternalID, err := internalID(ctx, s.repository, "collaboration_calls", input.CallID)
	if err != nil {
		return CallDetails{}, err
	}
	recordInternalID, err := internalID(ctx, s.repository, "completion_records", input.SourceRecordID)
	if err != nil {
		return CallDetails{}, ErrSubmissionInvalid
	}
	id, err := sharedid.Opaque("contribution")
	if err != nil {
		return CallDetails{}, err
	}
	if _, err := s.repository.Execute(ctx, `INSERT INTO collaboration_submissions (uuid, call_id, source_record_id, contributor_id, mapping_text, note) VALUES (?, ?, ?, ?, ?, ?)`, id, callInternalID, recordInternalID, input.UserID, input.MappingText, input.Note); err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "duplicate") {
			return CallDetails{}, ErrDuplicateSubmission
		}
		return CallDetails{}, err
	}
	return s.GetCallDetails(ctx, input.CallID)
}

func (s *Service) listSubmissions(ctx context.Context, callID string) ([]Submission, error) {
	rows, err := s.repository.Rows(ctx, `
		SELECT s.uuid, c.uuid, r.uuid, r.title, r.summary, source_project.title,
		       s.contributor_id, u.username, u.user_id, s.mapping_text, COALESCE(s.note, ''), s.status, s.created_at
		FROM collaboration_submissions s JOIN completion_records r ON r.id = s.source_record_id
		JOIN projects source_project ON source_project.id = r.project_id
		JOIN collaboration_calls c ON c.id = s.call_id JOIN users u ON u.id = s.contributor_id
		WHERE c.uuid = ? ORDER BY s.created_at DESC`, callID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]Submission, 0)
	for rows.Next() {
		var item Submission
		if err := rows.Scan(&item.ID, &item.CallID, &item.SourceRecordID, &item.SourceTitle, &item.SourceSummary, &item.SourceProjectTitle,
			&item.ContributorID, &item.ContributorName, &item.ContributorUserID, &item.MappingText, &item.Note, &item.Status, &item.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func internalID(ctx context.Context, db queryer, table, uuid string) (uint64, error) {
	allowed := map[string]string{"collaboration_calls": "collaboration_calls", "completion_records": "completion_records"}
	name, ok := allowed[table]
	if !ok {
		return 0, errors.New("unsupported collaboration entity")
	}
	var id uint64
	err := db.Row(ctx, "SELECT id FROM "+name+" WHERE uuid = ?", uuid).Scan(&id)
	return id, err
}
