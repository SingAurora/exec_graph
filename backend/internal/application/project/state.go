package project

import (
	"context"
	"database/sql"
	"encoding/json"
	"strings"

	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
)

// State 返回项目页面所需的完整执行状态。
func (s *Service) State(ctx context.Context, userID uint64, projectID string) (State, error) {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	item, err := s.Get(ctx, userID, projectID)
	if err != nil {
		return State{}, err
	}
	nodes, err := s.loadNodes(ctx, projectID)
	if err != nil {
		return State{}, err
	}
	edges, err := s.loadEdges(ctx, nodes)
	if err != nil {
		return State{}, err
	}
	branches, err := s.loadBranches(ctx, projectID)
	if err != nil {
		return State{}, err
	}
	records, err := s.loadCompletionRecords(ctx, projectID)
	if err != nil {
		return State{}, err
	}
	return State{Project: item, Nodes: nodes, Edges: edges, Branches: branches, CompletionRecords: records}, nil
}

func (s *Service) loadNodes(ctx context.Context, projectID string) ([]ExecutionNodeView, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT n.uuid, branch.uuid, revision.uuid, parent.uuid,
		       n.source_contract_ids_json, supplement_node.uuid, retry_node.uuid, n.actor_id, n.title, n.stage, n.original_intent,
		       contract.uuid, n.smart_contract_version, n.verifiable_goal,
		       n.acceptance_criteria_json, n.evidence_requirement, n.completion_claim,
		       n.evidence_text, n.started_at, n.ended_at, record.uuid, n.draft_review_json, n.draft_review_ai_config_json,
		       n.review_messages_json, n.ai_review_json, n.completion_review_ai_config_json, n.completion_review_rounds_json,
		       planning.uuid, completion.uuid, n.user_verdict_json, n.next_contract_title, n.created_at, n.updated_at
		FROM execution_contracts n
		JOIN projects p ON p.id = n.project_id
		LEFT JOIN execution_branches branch ON branch.id = n.branch_id
		JOIN project_contract_revisions revision ON revision.id = n.project_contract_revision_id
		LEFT JOIN execution_contracts parent ON parent.id = n.parent_contract_id
		LEFT JOIN execution_contracts supplement_node ON supplement_node.id = n.supplement_of_contract_id
		LEFT JOIN execution_contracts retry_node ON retry_node.id = n.retry_of_contract_id
		LEFT JOIN smart_contracts contract ON contract.id = n.smart_contract_id
		LEFT JOIN completion_records record ON record.id = n.completion_record_id
		LEFT JOIN node_conversations planning ON planning.id = n.planning_conversation_id
		LEFT JOIN node_conversations completion ON completion.id = n.completion_conversation_id
		WHERE p.uuid = ? ORDER BY n.created_at ASC`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	nodes := make([]ExecutionNodeView, 0)
	for rows.Next() {
		var node ExecutionNodeView
		var branchID, parentID, supplementID, retryID, recordID, nextTitle sql.NullString
		var actorID sql.NullInt64
		var sourceIDs, criteria, draftReview, draftAI, messages, aiReview, completionAI, rounds, planningID, completionID, verdict sql.NullString
		var claim, evidence sql.NullString
		var started, ended sql.NullTime
		if err := rows.Scan(&node.ID, &branchID, &node.ProjectContractRevisionID, &parentID, &sourceIDs, &supplementID, &retryID, &actorID,
			&node.Title, &node.Stage, &node.OriginalIntent, &node.SmartContractID, &node.SmartContractVersion, &node.VerifiableGoal,
			&criteria, &node.EvidenceRequirement, &claim, &evidence, &started, &ended, &recordID, &draftReview, &draftAI,
			&messages, &aiReview, &completionAI, &rounds, &planningID, &completionID, &verdict, &nextTitle, &node.CreatedAt, &node.UpdatedAt); err != nil {
			return nil, err
		}
		node.ProjectID = projectID
		node.BranchID = nullableString(branchID)
		node.ParentContractID = nullableString(parentID)
		node.SupplementOfContractID = nullableString(supplementID)
		node.RetryOfContractID = nullableString(retryID)
		node.CompletionRecordID = nullableString(recordID)
		node.CompletionClaim = nullableString(claim)
		node.EvidenceText = nullableString(evidence)
		node.PlanningConversationID = nullableString(planningID)
		node.CompletionConversationID = nullableString(completionID)
		node.NextContractTitle = nullableString(nextTitle)
		if actorID.Valid {
			value := uint64(actorID.Int64)
			node.ActorID = &value
		}
		if started.Valid {
			node.StartedAt = &started.Time
		}
		if ended.Valid {
			node.EndedAt = &ended.Time
		}
		node.SourceContractIDs, err = s.decodePublicIDs(ctx, sourceIDs.String)
		if err != nil {
			return nil, err
		}
		node.AcceptanceCriteria = decodeJSON(criteria.String, []any{})
		node.DraftReview = decodeOptional(draftReview)
		node.DraftReviewAIConfig = decodeOptional(draftAI)
		node.ReviewMessages = decodeJSON(messages.String, []any{})
		node.AIReview = decodeOptional(aiReview)
		node.CompletionReviewAIConfig = decodeOptional(completionAI)
		node.CompletionReviewRounds = decodeOptional(rounds)
		node.UserVerdict = decodeOptional(verdict)
		nodes = append(nodes, node)
	}
	return nodes, rows.Err()
}

func (s *Service) loadEdges(ctx context.Context, nodes []ExecutionNodeView) ([]ExecutionEdgeView, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT e.uuid, source_node.uuid, target_node.uuid, e.type, e.created_at
		FROM execution_edges e
		JOIN execution_contracts source_node ON source_node.id = e.source_contract_id
		JOIN execution_contracts target_node ON target_node.id = e.target_contract_id
		ORDER BY e.created_at ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	known := make(map[string]struct{}, len(nodes))
	for _, node := range nodes {
		known[node.ID] = struct{}{}
	}
	edges := make([]ExecutionEdgeView, 0)
	for rows.Next() {
		var edge ExecutionEdgeView
		if err := rows.Scan(&edge.ID, &edge.SourceContractID, &edge.TargetContractID, &edge.Type, &edge.CreatedAt); err != nil {
			return nil, err
		}
		if _, ok := known[edge.SourceContractID]; !ok {
			continue
		}
		if _, ok := known[edge.TargetContractID]; !ok {
			continue
		}
		edges = append(edges, edge)
	}
	return edges, rows.Err()
}

func (s *Service) loadBranches(ctx context.Context, projectID string) ([]ExecutionBranchView, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT b.uuid, p.uuid, b.title, root_node.uuid, forked_node.uuid, head_node.uuid, current_node.uuid, b.created_by, b.created_at
		FROM execution_branches b
		JOIN projects p ON p.id = b.project_id
		LEFT JOIN execution_contracts root_node ON root_node.id = b.root_contract_id
		LEFT JOIN execution_contracts forked_node ON forked_node.id = b.forked_from_contract_id
		LEFT JOIN execution_contracts head_node ON head_node.id = b.head_contract_id
		LEFT JOIN execution_contracts current_node ON current_node.id = b.current_contract_id
		WHERE p.uuid = ? ORDER BY b.created_at ASC`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	branches := make([]ExecutionBranchView, 0)
	for rows.Next() {
		var branch ExecutionBranchView
		var root, forked, head, current sql.NullString
		if err := rows.Scan(&branch.ID, &branch.ProjectID, &branch.Title, &root, &forked, &head, &current, &branch.CreatedByID, &branch.CreatedAt); err != nil {
			return nil, err
		}
		branch.RootContractID = nullableString(root)
		branch.ForkedFromContractID = nullableString(forked)
		branch.HeadContractID = nullableString(head)
		branch.CurrentContractID = nullableString(current)
		branches = append(branches, branch)
	}
	return branches, rows.Err()
}

func (s *Service) loadCompletionRecords(ctx context.Context, projectID string) ([]CompletionRecordView, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT r.uuid, p.uuid, closing_node.uuid, r.covered_contract_ids_json, r.title, r.summary,
		       contract.uuid, r.smart_contract_version, r.review_id, ai_review_verdict, record_kind, user_verdict_json, created_at
		FROM completion_records r
		JOIN projects p ON p.id = r.project_id
		JOIN execution_contracts closing_node ON closing_node.id = r.closing_contract_id
		JOIN smart_contracts contract ON contract.id = r.smart_contract_id
		WHERE p.uuid = ? ORDER BY r.created_at DESC`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	records := make([]CompletionRecordView, 0)
	for rows.Next() {
		var record CompletionRecordView
		var covered, verdict string
		if err := rows.Scan(&record.ID, &record.ProjectID, &record.ClosingContractID, &covered, &record.Title, &record.Summary,
			&record.SmartContractID, &record.SmartContractVersion, &record.ReviewID, &record.AIReviewVerdict, &record.RecordKind, &verdict, &record.CreatedAt); err != nil {
			return nil, err
		}
		for _, id := range decodeUint64IDs(covered) {
			value, err := publicUUID(ctx, s.db, "execution_contracts", id)
			if err != nil {
				return nil, err
			}
			record.CoveredContractIDs = append(record.CoveredContractIDs, value)
		}
		record.UserVerdict = decodeOptional(sql.NullString{String: verdict, Valid: strings.TrimSpace(verdict) != ""})
		records = append(records, record)
	}
	return records, rows.Err()
}

func (s *Service) decodePublicIDs(ctx context.Context, raw string) ([]string, error) {
	ids := decodeUint64IDs(raw)
	result := make([]string, 0, len(ids))
	for _, id := range ids {
		value, err := publicUUID(ctx, s.db, "execution_contracts", id)
		if err != nil {
			return nil, err
		}
		result = append(result, value)
	}
	return result, nil
}

func decodeUint64IDs(value string) []uint64 {
	if strings.TrimSpace(value) == "" {
		return []uint64{}
	}
	var ids []uint64
	if err := json.Unmarshal([]byte(value), &ids); err != nil {
		return []uint64{}
	}
	return ids
}

func nullableString(value sql.NullString) *string {
	if !value.Valid {
		return nil
	}
	return &value.String
}

func decodeOptional(value sql.NullString) any {
	if !value.Valid || strings.TrimSpace(value.String) == "" {
		return nil
	}
	return decodeJSON(value.String, nil)
}

func decodeJSON(value string, fallback any) any {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	var decoded any
	if err := json.Unmarshal([]byte(value), &decoded); err != nil {
		return fallback
	}
	return decoded
}
