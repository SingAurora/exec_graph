package project

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strings"

	projectpersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/project"
	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
	sharedid "github.com/singaurora/exec-graph/backend/internal/shared/id"
)

const (
	generalSmartContractID = "smart-contract-general"
	quickActionContractID  = "smart-contract-quick-action"
	dailyRoutineContractID = "smart-contract-daily-routine"
)

var (
	ErrInvalidProject      = errors.New("invalid project")
	ErrContractUnavailable = errors.New("smart contract unavailable")
	ErrCallUnavailable     = errors.New("contribution call unavailable")
)

var publicIDTables = map[string]string{
	"ai_api_keys":                "ai_api_keys",
	"collaboration_calls":        "collaboration_calls",
	"execution_contracts":        "execution_contracts",
	"project_contract_revisions": "project_contract_revisions",
}

// List 返回当前用户的项目摘要。项目详情由同一个领域服务统一组装。
func (s *Service) List(ctx context.Context, userID uint64) ([]ProjectView, error) {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	ids, err := s.projects.ListIDsForOwner(ctx, userID)
	if err != nil {
		return nil, err
	}
	projects := make([]ProjectView, 0, len(ids))
	for _, id := range ids {
		item, err := s.Get(ctx, userID, id)
		if err != nil {
			return nil, err
		}
		projects = append(projects, item)
	}
	return projects, nil
}

// Get 返回项目资料及其当前合约修订。节点图属于 ProjectState，单独读取。
func (s *Service) Get(ctx context.Context, userID uint64, projectID string) (ProjectView, error) {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	stored, err := s.projects.FindForOwner(ctx, userID, projectID)
	if errors.Is(err, projectpersistence.ErrNotFound) {
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
		value, err := publicUUID(ctx, s.execution, "ai_api_keys", *stored.DefaultAIKeyID)
		if err != nil {
			return ProjectView{}, err
		}
		item.ReviewAIKeyID = &value
	}
	if stored.CurrentContractID != nil {
		value, err := publicUUID(ctx, s.execution, "execution_contracts", *stored.CurrentContractID)
		if err != nil {
			return ProjectView{}, err
		}
		item.CurrentContractID = &value
	}
	if stored.ActiveContractRevisionID != nil {
		value, err := publicUUID(ctx, s.execution, "project_contract_revisions", *stored.ActiveContractRevisionID)
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
		callID, err := publicUUID(ctx, s.execution, "collaboration_calls", *stored.ContributionCallID)
		if err != nil {
			return ProjectView{}, err
		}
		origin, err := s.ContributionOrigin(ctx, callID)
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

// Create 创建项目及其第一条合约修订，整个过程在一个事务内完成。
func (s *Service) Create(ctx context.Context, input CreateInput) (ProjectView, error) {
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
	tx, err := s.execution.Begin(ctx)
	if err != nil {
		return ProjectView{}, err
	}
	defer tx.Rollback()

	var contractInternalID uint64
	var contractName, contractDescription, contractVersion, contractBody string
	err = tx.Row(ctx, `
		SELECT id, name, description, version, body FROM smart_contracts
		WHERE uuid = ? AND deleted_at IS NULL AND (source = 'official' OR created_by = ?)`,
		input.SmartContractID, input.OwnerID).Scan(&contractInternalID, &contractName, &contractDescription, &contractVersion, &contractBody)
	if errors.Is(err, sql.ErrNoRows) {
		return ProjectView{}, ErrContractUnavailable
	}
	if err != nil {
		return ProjectView{}, err
	}
	var aiKeyInternalID uint64
	if err := tx.Row(ctx, `SELECT id FROM ai_api_keys WHERE uuid = ? AND user_id = ?`, input.AIKeyID, input.OwnerID).Scan(&aiKeyInternalID); errors.Is(err, sql.ErrNoRows) {
		return ProjectView{}, ErrAIKeyUnavailable
	} else if err != nil {
		return ProjectView{}, err
	}

	projectID, err := sharedid.Opaque("project")
	if err != nil {
		return ProjectView{}, err
	}
	revisionID, err := sharedid.Opaque("project-revision")
	if err != nil {
		return ProjectView{}, err
	}
	var contributionCallInternalID *uint64
	if input.ContributionCallID != "" {
		var callID, ownerID uint64
		var status, stage string
		err := tx.Row(ctx, `
			SELECT c.id, p.owner_id, c.status, n.stage
			FROM collaboration_calls c
			JOIN projects p ON p.id = c.project_id
			JOIN execution_contracts n ON n.id = c.target_contract_id
			WHERE c.uuid = ? FOR UPDATE`, input.ContributionCallID).Scan(&callID, &ownerID, &status, &stage)
		if errors.Is(err, sql.ErrNoRows) {
			return ProjectView{}, ErrCallUnavailable
		}
		if err != nil {
			return ProjectView{}, err
		}
		if ownerID == input.OwnerID || status != "open" || stage != "frozen" {
			return ProjectView{}, ErrCallUnavailable
		}
		input.Visibility = "public"
		input.ProjectType = "autonomous"
		input.ProjectRules = ""
		contributionCallInternalID = &callID
	}
	var snapshot string
	if input.ContributionCallID != "" {
		origin, err := s.ContributionOrigin(ctx, input.ContributionCallID)
		if err != nil {
			return ProjectView{}, err
		}
		encoded, err := json.Marshal(origin)
		if err != nil {
			return ProjectView{}, err
		}
		snapshot = string(encoded)
	}
	result, err := tx.Execute(ctx, `
		INSERT INTO projects
			(uuid, owner_id, title, description, project_type, project_rules, is_default, visibility, default_ai_key_id, contribution_call_id, contribution_origin_snapshot_json)
		VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, NULLIF(?, ''))`,
		projectID, input.OwnerID, input.Title, input.Description, input.ProjectType, input.ProjectRules,
		input.Visibility, aiKeyInternalID, contributionCallInternalID, snapshot)
	if err != nil {
		return ProjectView{}, err
	}
	projectInternalID, err := result.LastInsertId()
	if err != nil {
		return ProjectView{}, err
	}
	revisionResult, err := tx.Execute(ctx, `
		INSERT INTO project_contract_revisions
			(uuid, project_id, smart_contract_id, smart_contract_version, reason, smart_contract_name, smart_contract_description, smart_contract_body)
		VALUES (?, ?, ?, ?, '项目创建时的基础审查规则', ?, ?, ?)`,
		revisionID, projectInternalID, contractInternalID, contractVersion, contractName, contractDescription, contractBody)
	if err != nil {
		return ProjectView{}, err
	}
	revisionInternalID, err := revisionResult.LastInsertId()
	if err != nil {
		return ProjectView{}, err
	}
	if _, err := tx.Execute(ctx, `UPDATE projects SET active_contract_revision_id = ? WHERE id = ?`, revisionInternalID, projectInternalID); err != nil {
		return ProjectView{}, err
	}
	if err := tx.Commit(); err != nil {
		return ProjectView{}, err
	}
	return s.Get(ctx, input.OwnerID, projectID)
}

// ContributionOrigin 返回开放缺口交接给贡献者所需的上下文和已有来源。
func (s *Service) ContributionOrigin(ctx context.Context, callID string) (ContributionOrigin, error) {
	var origin ContributionOrigin
	var criteriaJSON string
	err := s.execution.Row(ctx, `
		SELECT c.uuid, p.uuid, p.title, c.title, c.status,
		       n.title, n.verifiable_goal, n.acceptance_criteria_json, n.evidence_requirement
		FROM collaboration_calls c
		JOIN projects p ON p.id = c.project_id
		JOIN execution_contracts n ON n.id = c.target_contract_id
		WHERE c.uuid = ?`, callID).Scan(
		&origin.CallID, &origin.ProjectID, &origin.ProjectTitle, &origin.CallTitle, &origin.Status,
		&origin.TargetTitle, &origin.VerifiableGoal, &criteriaJSON, &origin.EvidenceRequirement)
	if err != nil {
		return origin, err
	}
	_ = json.Unmarshal([]byte(criteriaJSON), &origin.AcceptanceCriteria)
	rows, err := s.execution.Rows(ctx, `
		SELECT r.title, p.title, s.mapping_text, s.status
		FROM collaboration_submissions s
		JOIN completion_records r ON r.id = s.source_record_id
		JOIN projects p ON p.id = r.project_id
		JOIN collaboration_calls c ON c.id = s.call_id
		WHERE c.uuid = ? AND s.status <> 'withdrawn'
		ORDER BY s.created_at ASC`, callID)
	if err != nil {
		return origin, err
	}
	defer rows.Close()
	origin.AvailableSources = make([]ContributionOriginSource, 0)
	for rows.Next() {
		var source ContributionOriginSource
		if err := rows.Scan(&source.Title, &source.ProjectTitle, &source.MappingText, &source.Status); err != nil {
			return origin, err
		}
		origin.AvailableSources = append(origin.AvailableSources, source)
	}
	return origin, rows.Err()
}

func publicUUID(ctx context.Context, db queryer, entity string, id uint64) (string, error) {
	table, ok := publicIDTables[entity]
	if !ok {
		return "", errors.New("unsupported public id entity")
	}
	var uuid string
	if err := db.Row(ctx, "SELECT uuid FROM "+table+" WHERE id = ?", id).Scan(&uuid); err != nil {
		return "", err
	}
	return uuid, nil
}
