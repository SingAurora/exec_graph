package project

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
	sharedid "github.com/singaurora/exec-graph/backend/internal/shared/id"
)

// LockNode 根据最近一次 AI 审查结果，创建完成记录并关闭当前推进。
func (s *Service) LockNode(ctx context.Context, userID uint64, projectID, nodeID string) (State, error) {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	tx, err := s.execution.Begin(ctx)
	if err != nil {
		return State{}, err
	}
	defer tx.Rollback()

	var projectInternalID uint64
	var archivedAt sql.NullTime
	err = tx.Row(ctx, `SELECT id, archived_at FROM projects WHERE uuid = ? AND owner_id = ? FOR UPDATE`, projectID, userID).Scan(&projectInternalID, &archivedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return State{}, ErrNotFound
	}
	if err != nil {
		return State{}, err
	}
	if archivedAt.Valid {
		return State{}, &ValidationError{"项目已归档，不能锁定节点"}
	}

	var nodeInternalID, smartContractInternalID uint64
	var stage, title, smartContractVersion, reviewJSON, messagesJSON string
	var branchID, currentProjectNode sql.NullInt64
	err = tx.Row(ctx, `
		SELECT n.id, n.stage, n.title, n.branch_id, n.smart_contract_id, n.smart_contract_version,
		       n.ai_review_json, n.review_messages_json, p.current_contract_id
		FROM execution_contracts n JOIN projects p ON p.id = n.project_id
		WHERE n.uuid = ? AND n.project_id = ? AND p.owner_id = ? FOR UPDATE`, nodeID, projectInternalID, userID).
		Scan(&nodeInternalID, &stage, &title, &branchID, &smartContractInternalID, &smartContractVersion, &reviewJSON, &messagesJSON, &currentProjectNode)
	if errors.Is(err, sql.ErrNoRows) {
		return State{}, &ValidationError{"节点不存在"}
	}
	if err != nil {
		return State{}, err
	}
	if stage != "verified" && stage != "needs_supplement" {
		return State{}, &ValidationError{"节点尚未获得 AI 审查结果"}
	}
	if !branchID.Valid && (!currentProjectNode.Valid || uint64(currentProjectNode.Int64) != nodeInternalID) {
		return State{}, &ValidationError{"该节点不是项目当前待确认节点"}
	}
	if branchID.Valid {
		var currentBranchNode sql.NullInt64
		if err := tx.Row(ctx, `SELECT current_contract_id FROM execution_branches WHERE id = ? AND project_id = ? FOR UPDATE`, branchID.Int64, projectInternalID).Scan(&currentBranchNode); err != nil || !currentBranchNode.Valid || uint64(currentBranchNode.Int64) != nodeInternalID {
			return State{}, &ValidationError{"该节点不是路径当前待确认节点"}
		}
	}
	var review struct {
		ID      string `json:"id"`
		Verdict string `json:"verdict"`
	}
	if err := json.Unmarshal([]byte(reviewJSON), &review); err != nil || review.ID == "" {
		return State{}, &ValidationError{"节点没有可锁定的 AI 审查记录"}
	}

	coveredIDs := []uint64{nodeInternalID}
	createdAt := time.Now()
	recordKind, terminalStage := "accepted", "completed"
	verdict := map[string]any{"result": "confirmed_complete", "note": "我确认 AI 审查通过的结果属实，并签名锁定这次推进覆盖的节点。", "createdAt": createdAt}
	summary := fmt.Sprintf("智能合约审查通过，并由本人确认；这条完成记录覆盖 %d 个推进节点。", len(coveredIDs))
	message := "我签名确认：AI 审查通过，并锁定这次推进覆盖的节点。"
	if review.Verdict != "pass" {
		recordKind, terminalStage = "sealed", "sealed"
		verdict = map[string]any{"result": "sealed_with_ai_gap", "note": "我已看到 AI 审查指出的缺口，决定封存这次推进；它不会作为已验收成果使用。", "createdAt": createdAt}
		summary = fmt.Sprintf("AI 审查仍有缺口，本人决定封存这次推进；保留 %d 个行动节点及其证据，但不记为已验收成果。", len(coveredIDs))
		message = "我已看到 AI 审查指出的缺口，决定封存这次推进并保留全部证据。"
	}
	verdictJSON, err := json.Marshal(verdict)
	if err != nil {
		return State{}, err
	}
	var messages []any
	_ = json.Unmarshal([]byte(messagesJSON), &messages)
	messageID, err := sharedid.Opaque("message")
	if err != nil {
		return State{}, err
	}
	messages = append(messages, map[string]any{"id": messageID, "speaker": "user", "body": message, "createdAt": createdAt})
	updatedMessagesJSON, err := json.Marshal(messages)
	if err != nil {
		return State{}, err
	}
	recordID, err := sharedid.Opaque("record")
	if err != nil {
		return State{}, err
	}
	coveredJSON, err := json.Marshal(coveredIDs)
	if err != nil {
		return State{}, err
	}
	result, err := tx.Execute(ctx, `
		INSERT INTO completion_records
			(uuid, project_id, closing_contract_id, covered_contract_ids_json, title, summary,
			 smart_contract_id, smart_contract_version, review_id, ai_review_verdict, record_kind, user_verdict_json)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		recordID, projectInternalID, nodeInternalID, coveredJSON, title, summary, smartContractInternalID, smartContractVersion, review.ID, review.Verdict, recordKind, verdictJSON)
	if err != nil {
		return State{}, err
	}
	recordInternalID, err := result.LastInsertId()
	if err != nil {
		return State{}, err
	}
	for _, coveredID := range coveredIDs {
		if _, err := tx.Execute(ctx, `UPDATE execution_contracts SET stage = ?, completion_record_id = ? WHERE id = ? AND project_id = ?`, terminalStage, recordInternalID, coveredID, projectInternalID); err != nil {
			return State{}, err
		}
	}
	if _, err := tx.Execute(ctx, `UPDATE node_conversations SET status = 'closed' WHERE project_id = ? AND node_id = ? AND owner_id = ? AND phase = 'completion' AND status = 'active'`, projectInternalID, nodeInternalID, userID); err != nil {
		return State{}, err
	}
	if _, err := tx.Execute(ctx, `UPDATE execution_contracts SET user_verdict_json = ?, review_messages_json = ? WHERE uuid = ?`, verdictJSON, updatedMessagesJSON, nodeID); err != nil {
		return State{}, err
	}
	if branchID.Valid {
		if _, err := tx.Execute(ctx, `UPDATE execution_branches SET head_contract_id = ?, current_contract_id = NULL WHERE id = ?`, nodeInternalID, branchID.Int64); err != nil {
			return State{}, err
		}
	} else if _, err := tx.Execute(ctx, `UPDATE projects SET current_contract_id = NULL WHERE id = ? AND current_contract_id = ?`, projectInternalID, nodeInternalID); err != nil {
		return State{}, err
	}
	if err := tx.Commit(); err != nil {
		return State{}, err
	}
	return s.State(ctx, userID, projectID)
}

type nodeSource struct {
	id       uint64
	branchID sql.NullInt64
}

type queryer interface {
	Row(context.Context, string, ...any) *sql.Row
}

func (s *Service) CreateNode(ctx context.Context, input CreateNodeInput) (CreateNodeResult, error) {
	input.Title = strings.TrimSpace(input.Title)
	input.Draft = strings.TrimSpace(input.Draft)
	input.VerifiableGoal = strings.TrimSpace(input.VerifiableGoal)
	input.EvidenceRequirement = strings.TrimSpace(input.EvidenceRequirement)
	input.RetryOfContractID = strings.TrimSpace(input.RetryOfContractID)
	input.SupplementOfNodeID = strings.TrimSpace(input.SupplementOfNodeID)
	if input.DraftReviewVerdict != "pass" {
		return CreateNodeResult{}, &ValidationError{"节点草案必须先通过 AI 审核"}
	}
	if input.Title == "" || input.VerifiableGoal == "" || input.EvidenceRequirement == "" || input.Draft == "" || len(input.AcceptanceCriteria) == 0 {
		return CreateNodeResult{}, &ValidationError{"节点的目标、验收标准或证据要求不完整"}
	}
	for _, criterion := range input.AcceptanceCriteria {
		if strings.TrimSpace(criterion.ID) == "" || strings.TrimSpace(criterion.Text) == "" || strings.TrimSpace(criterion.RequiredEvidence) == "" {
			return CreateNodeResult{}, &ValidationError{"节点验收标准不完整"}
		}
	}

	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	tx, err := s.execution.Begin(ctx)
	if err != nil {
		return CreateNodeResult{}, err
	}
	defer tx.Rollback()

	var projectInternalID, revisionInternalID uint64
	var visibility string
	var currentProjectNode sql.NullInt64
	var archivedAt sql.NullTime
	err = tx.Row(ctx, `
		SELECT id, visibility, active_contract_revision_id, current_contract_id, archived_at
		FROM projects WHERE uuid = ? AND owner_id = ? FOR UPDATE`, input.ProjectID, input.OwnerID).
		Scan(&projectInternalID, &visibility, &revisionInternalID, &currentProjectNode, &archivedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return CreateNodeResult{}, ErrNotFound
	}
	if err != nil {
		return CreateNodeResult{}, err
	}
	if archivedAt.Valid {
		return CreateNodeResult{}, &ValidationError{"项目已归档，不能创建推进节点"}
	}

	var configuredKeyID, keyLabel, provider, model, baseURL string
	err = tx.Row(ctx, `
		SELECT k.uuid, k.label, k.provider, k.model, k.base_url
		FROM projects p JOIN ai_api_keys k ON k.id = p.default_ai_key_id
		WHERE p.uuid = ? AND p.owner_id = ?`, input.ProjectID, input.OwnerID).
		Scan(&configuredKeyID, &keyLabel, &provider, &model, &baseURL)
	if errors.Is(err, sql.ErrNoRows) {
		return CreateNodeResult{}, &ValidationError{"请先为项目选择审查 AI"}
	}
	if err != nil {
		return CreateNodeResult{}, err
	}
	if strings.TrimSpace(input.DraftReviewKeyID) != configuredKeyID {
		return CreateNodeResult{}, &ValidationError{"项目审查 AI 已变更，请重新审核节点草案"}
	}
	draftAIConfig := map[string]any{"keyId": configuredKeyID, "label": keyLabel, "provider": provider, "model": model, "baseUrl": baseURL}

	var smartContractID, smartContractVersion string
	var smartContractInternalID uint64
	if err := tx.Row(ctx, `
		SELECT c.id, c.uuid, revision.smart_contract_version
		FROM project_contract_revisions revision
		JOIN smart_contracts c ON c.id = revision.smart_contract_id
		WHERE revision.id = ? AND revision.project_id = ?`, revisionInternalID, projectInternalID).
		Scan(&smartContractInternalID, &smartContractID, &smartContractVersion); err != nil {
		return CreateNodeResult{}, err
	}

	sourceIDs := uniqueNonEmpty(input.SourceContractIDs)
	if len(sourceIDs) == 0 && input.ParentContractID != "" {
		sourceIDs = []string{input.ParentContractID}
	}
	if len(sourceIDs) == 0 {
		var nodeCount int
		if err := tx.Row(ctx, `SELECT COUNT(*) FROM execution_contracts WHERE project_id = ?`, projectInternalID).Scan(&nodeCount); err != nil {
			return CreateNodeResult{}, err
		}
		if nodeCount > 0 {
			if input.RetryOfContractID == "" {
				return CreateNodeResult{}, &ValidationError{"后续推进必须从已验收成果继续，或从一项已封存的尝试重新开始"}
			}
			var retryStage string
			if err := tx.Row(ctx, `SELECT stage FROM execution_contracts WHERE uuid = ? AND project_id = ? FOR UPDATE`, input.RetryOfContractID, projectInternalID).Scan(&retryStage); err != nil || retryStage != "sealed" {
				return CreateNodeResult{}, &ValidationError{"只能基于本项目已封存的尝试重新开始"}
			}
			var activeCount int
			if err := tx.Row(ctx, `SELECT COUNT(*) FROM execution_contracts WHERE project_id = ? AND stage IN ('frozen', 'verified', 'needs_supplement')`, projectInternalID).Scan(&activeCount); err != nil {
				return CreateNodeResult{}, err
			}
			if activeCount > 0 {
				return CreateNodeResult{}, &ValidationError{"项目仍有等待处理的行动，不能同时重新开始"}
			}
		}
	}

	isSupplement := input.SupplementOfNodeID != ""
	isClosure := input.Closure && !isSupplement
	sources := make([]nodeSource, 0, len(sourceIDs))
	for _, sourceID := range sourceIDs {
		var stage string
		var sourceInternalID uint64
		var completionID, branchID sql.NullInt64
		err := tx.Row(ctx, `
			SELECT id, stage, completion_record_id, branch_id
			FROM execution_contracts WHERE uuid = ? AND project_id = ? FOR UPDATE`, sourceID, projectInternalID).
			Scan(&sourceInternalID, &stage, &completionID, &branchID)
		isSupplementSource := isSupplement && len(sourceIDs) == 1 && sourceID == input.SupplementOfNodeID && stage == "needs_supplement"
		isClosureSource := isClosure && len(sourceIDs) == 1 && stage == "frozen"
		if errors.Is(err, sql.ErrNoRows) || (!isSupplementSource && !isClosureSource && (stage != "completed" || !completionID.Valid)) {
			return CreateNodeResult{}, &ValidationError{"节点只能从同一项目已锁定的完成记录继续，或处理 AI 指出的补足缺口"}
		}
		if err != nil {
			return CreateNodeResult{}, err
		}
		sources = append(sources, nodeSource{id: sourceInternalID, branchID: branchID})
	}

	nodeID, err := sharedid.Opaque("node")
	if err != nil {
		return CreateNodeResult{}, err
	}
	var parentInternalID any
	if len(sourceIDs) == 1 {
		parentInternalID = sources[0].id
	}
	branchID := ""
	var branchInternalID any
	createBranch := false
	if len(sourceIDs) == 0 {
		createBranch = visibility == "public"
	} else if len(sourceIDs) > 1 {
		if currentProjectNode.Valid {
			return CreateNodeResult{}, &ValidationError{"请先结算当前推进，再开始汇合行动"}
		}
	} else if input.Fork {
		createBranch = true
	} else if input.BranchID != "" {
		branchID = input.BranchID
		branchInternalID, err = internalIDFor(ctx, tx, "execution_branches", branchID)
		if err != nil {
			return CreateNodeResult{}, &ValidationError{"节点路径不存在"}
		}
	} else if sources[0].branchID.Valid {
		branchInternalID = uint64(sources[0].branchID.Int64)
		branchID, err = publicUUIDFor(ctx, tx, "execution_branches", uint64(sources[0].branchID.Int64))
		if err != nil {
			return CreateNodeResult{}, err
		}
	}

	if branchID != "" {
		var headID, currentID sql.NullInt64
		err := tx.Row(ctx, `SELECT head_contract_id, current_contract_id FROM execution_branches WHERE id = ? AND project_id = ? FOR UPDATE`, branchInternalID, projectInternalID).Scan(&headID, &currentID)
		allowsReplacingSource := (isSupplement || isClosure) && currentID.Valid && parentInternalID != nil && uint64(currentID.Int64) == parentInternalID.(uint64)
		if errors.Is(err, sql.ErrNoRows) || !headID.Valid || parentInternalID == nil || uint64(headID.Int64) != parentInternalID.(uint64) || (currentID.Valid && !allowsReplacingSource) {
			return CreateNodeResult{}, &ValidationError{"这条节点路径已经不是可继续的末端"}
		}
		if err != nil {
			return CreateNodeResult{}, err
		}
	} else if !createBranch && currentProjectNode.Valid && !((isSupplement || isClosure) && parentInternalID != nil && uint64(currentProjectNode.Int64) == parentInternalID.(uint64)) {
		return CreateNodeResult{}, &ValidationError{"项目当前还有一项推进等待处理"}
	}

	if createBranch {
		branchID, err = sharedid.Opaque("branch")
		if err != nil {
			return CreateNodeResult{}, err
		}
		result, err := tx.Execute(ctx, `INSERT INTO execution_branches (uuid, project_id, title, created_by) VALUES (?, ?, ?, ?)`, branchID, projectInternalID, input.Title, input.OwnerID)
		if err != nil {
			return CreateNodeResult{}, err
		}
		branchInternalID, err = result.LastInsertId()
		if err != nil {
			return CreateNodeResult{}, err
		}
	}
	criteriaJSON, err := json.Marshal(input.AcceptanceCriteria)
	if err != nil {
		return CreateNodeResult{}, err
	}
	internalSourceIDs := make([]uint64, 0, len(sources))
	for _, source := range sources {
		internalSourceIDs = append(internalSourceIDs, source.id)
	}
	sourceJSON, err := json.Marshal(internalSourceIDs)
	if err != nil {
		return CreateNodeResult{}, err
	}
	draftReviewJSON, err := json.Marshal(input.DraftReview)
	if err != nil {
		return CreateNodeResult{}, err
	}
	draftAIConfigJSON, err := json.Marshal(draftAIConfig)
	if err != nil {
		return CreateNodeResult{}, err
	}
	messageID, err := sharedid.Opaque("message")
	if err != nil {
		return CreateNodeResult{}, err
	}
	messagesJSON, err := json.Marshal([]map[string]any{{"id": messageID, "speaker": "ai", "body": "推进节点已通过 AI 草案审核，目标、验收标准和证据要求已冻结。", "createdAt": time.Now()}})
	if err != nil {
		return CreateNodeResult{}, err
	}
	supplementInternalID, err := optionalInternalIDFor(ctx, tx, "execution_contracts", input.SupplementOfNodeID)
	if err != nil {
		return CreateNodeResult{}, &ValidationError{"补足节点不存在"}
	}
	retryInternalID, err := optionalInternalIDFor(ctx, tx, "execution_contracts", input.RetryOfContractID)
	if err != nil {
		return CreateNodeResult{}, &ValidationError{"重试节点不存在"}
	}
	planningConversationInternalID, err := optionalInternalIDFor(ctx, tx, "node_conversations", input.PlanningConversationID)
	if err != nil {
		return CreateNodeResult{}, &ValidationError{"起草对话不存在"}
	}
	result, err := tx.Execute(ctx, `
		INSERT INTO execution_contracts
			(uuid, project_id, branch_id, project_contract_revision_id, parent_contract_id, source_contract_ids_json, supplement_of_contract_id, retry_of_contract_id,
			 actor_id, title, stage, original_intent, smart_contract_id, smart_contract_version,
			 verifiable_goal, acceptance_criteria_json, evidence_requirement, draft_review_json, draft_review_ai_config_json, review_messages_json, planning_conversation_id)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'frozen', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		nodeID, projectInternalID, branchInternalID, revisionInternalID, parentInternalID, sourceJSON, supplementInternalID, retryInternalID,
		input.OwnerID, input.Title, input.Draft, smartContractInternalID, smartContractVersion, input.VerifiableGoal, criteriaJSON, input.EvidenceRequirement,
		draftReviewJSON, draftAIConfigJSON, messagesJSON, planningConversationInternalID)
	if err != nil {
		return CreateNodeResult{}, err
	}
	nodeInternalID, err := result.LastInsertId()
	if err != nil {
		return CreateNodeResult{}, err
	}
	for _, source := range sources {
		edgeID, err := sharedid.Opaque("edge")
		if err != nil {
			return CreateNodeResult{}, err
		}
		edgeType := "lineage"
		if isSupplement {
			edgeType = "supplement"
		} else if isClosure {
			edgeType = "closure"
		} else if createBranch {
			edgeType = "fork"
		} else if len(sourceIDs) > 1 {
			edgeType = "merge"
		}
		if _, err := tx.Execute(ctx, `INSERT INTO execution_edges (uuid, source_contract_id, target_contract_id, type) VALUES (?, ?, ?, ?)`, edgeID, source.id, nodeInternalID, edgeType); err != nil {
			return CreateNodeResult{}, err
		}
	}
	if input.RetryOfContractID != "" {
		edgeID, err := sharedid.Opaque("edge")
		if err != nil {
			return CreateNodeResult{}, err
		}
		if _, err := tx.Execute(ctx, `INSERT INTO execution_edges (uuid, source_contract_id, target_contract_id, type) VALUES (?, ?, ?, 'reference')`, edgeID, retryInternalID, nodeInternalID); err != nil {
			return CreateNodeResult{}, err
		}
	}
	if branchID != "" && !createBranch {
		if _, err := tx.Execute(ctx, `UPDATE execution_branches SET head_contract_id = ?, current_contract_id = ? WHERE id = ?`, nodeInternalID, nodeInternalID, branchInternalID); err != nil {
			return CreateNodeResult{}, err
		}
	}
	if branchID == "" {
		if _, err := tx.Execute(ctx, `UPDATE projects SET current_contract_id = ? WHERE id = ?`, nodeInternalID, projectInternalID); err != nil {
			return CreateNodeResult{}, err
		}
	}
	if createBranch {
		if _, err := tx.Execute(ctx, `UPDATE execution_branches SET root_contract_id = ?, forked_from_contract_id = ?, head_contract_id = ?, current_contract_id = ? WHERE id = ?`, nodeInternalID, parentInternalID, nodeInternalID, nodeInternalID, branchInternalID); err != nil {
			return CreateNodeResult{}, err
		}
	}
	if err := tx.Commit(); err != nil {
		return CreateNodeResult{}, err
	}
	if input.PlanningConversationID != "" {
		_, _ = s.execution.Execute(ctx, `UPDATE node_conversations SET node_id = ?, status = 'frozen' WHERE uuid = ? AND project_id = ? AND owner_id = ?`, nodeInternalID, input.PlanningConversationID, projectInternalID, input.OwnerID)
	}
	state, err := s.State(ctx, input.OwnerID, input.ProjectID)
	return CreateNodeResult{NodeID: nodeID, State: state}, err
}

func uniqueNonEmpty(values []string) []string {
	result := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}

func internalIDFor(ctx context.Context, db queryer, entity, uuid string) (uint64, error) {
	table, ok := nodeIDTables[entity]
	if !ok {
		return 0, errors.New("unsupported node id entity")
	}
	var id uint64
	err := db.Row(ctx, "SELECT id FROM "+table+" WHERE uuid = ?", uuid).Scan(&id)
	return id, err
}

func optionalInternalIDFor(ctx context.Context, db queryer, entity, uuid string) (any, error) {
	if strings.TrimSpace(uuid) == "" {
		return nil, nil
	}
	return internalIDFor(ctx, db, entity, uuid)
}

func publicUUIDFor(ctx context.Context, db queryer, entity string, id uint64) (string, error) {
	table, ok := nodeIDTables[entity]
	if !ok {
		return "", errors.New("unsupported node id entity")
	}
	var uuid string
	err := db.Row(ctx, "SELECT uuid FROM "+table+" WHERE id = ?", id).Scan(&uuid)
	return uuid, err
}
