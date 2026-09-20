package project

import (
	"context"
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
	values, err := s.execution.ListNodeProjections(ctx, projectID)
	if err != nil {
		return nil, err
	}
	result := make([]ExecutionNodeView, 0, len(values))
	for _, value := range values {
		node := ExecutionNodeView{ID: value.UUID, ProjectID: projectID, BranchID: value.BranchUUID, ProjectContractRevisionID: value.RevisionUUID, ParentContractID: value.ParentUUID, SupplementOfContractID: value.SupplementUUID, RetryOfContractID: value.RetryUUID, ActorID: value.ActorID, Title: value.Title, Stage: value.Stage, OriginalIntent: value.OriginalIntent, SmartContractID: value.SmartContractUUID, SmartContractVersion: value.SmartContractVersion, VerifiableGoal: value.Goal, EvidenceRequirement: value.EvidenceRequirement, CompletionClaim: value.Claim, EvidenceText: value.Evidence, StartedAt: value.StartedAt, EndedAt: value.EndedAt, CompletionRecordID: value.RecordUUID, NextContractTitle: value.NextTitle, CreatedAt: value.CreatedAt, UpdatedAt: value.UpdatedAt}
		node.SourceContractIDs, err = s.decodePublicIDs(ctx, value.SourceIDs)
		if err != nil {
			return nil, err
		}
		node.AcceptanceCriteria = decodeJSON(value.Criteria, []any{})
		node.DraftReview = decodeJSONPointer(value.DraftReview, nil)
		node.DraftReviewAIConfig = decodeJSONPointer(value.DraftAI, nil)
		node.ReviewMessages = decodeJSONPointer(value.ReviewMessages, []any{})
		node.AIReview = decodeJSONPointer(value.AIReview, nil)
		node.CompletionReviewAIConfig = decodeJSONPointer(value.CompletionAI, nil)
		node.CompletionReviewRounds = decodeJSONPointer(value.ReviewRounds, nil)
		node.UserVerdict = decodeJSONPointer(value.Verdict, nil)
		result = append(result, node)
	}
	return result, nil
}

func (s *Service) loadEdges(ctx context.Context, nodes []ExecutionNodeView) ([]ExecutionEdgeView, error) {
	values, err := s.execution.ListEdgeProjections(ctx)
	if err != nil {
		return nil, err
	}
	known := make(map[string]struct{}, len(nodes))
	for _, node := range nodes {
		known[node.ID] = struct{}{}
	}
	result := make([]ExecutionEdgeView, 0, len(values))
	for _, value := range values {
		if _, ok := known[value.SourceUUID]; !ok {
			continue
		}
		if _, ok := known[value.TargetUUID]; !ok {
			continue
		}
		result = append(result, ExecutionEdgeView{ID: value.UUID, SourceContractID: value.SourceUUID, TargetContractID: value.TargetUUID, Type: value.Type, CreatedAt: value.CreatedAt})
	}
	return result, nil
}

func (s *Service) loadBranches(ctx context.Context, projectID string) ([]ExecutionBranchView, error) {
	values, err := s.execution.ListBranchProjections(ctx, projectID)
	if err != nil {
		return nil, err
	}
	result := make([]ExecutionBranchView, 0, len(values))
	for _, value := range values {
		result = append(result, ExecutionBranchView{ID: value.UUID, ProjectID: value.ProjectUUID, Title: value.Title, RootContractID: value.RootUUID, ForkedFromContractID: value.ForkedUUID, HeadContractID: value.HeadUUID, CurrentContractID: value.CurrentUUID, CreatedByID: value.CreatedBy, CreatedAt: value.CreatedAt})
	}
	return result, nil
}

func (s *Service) loadCompletionRecords(ctx context.Context, projectID string) ([]CompletionRecordView, error) {
	values, err := s.execution.ListCompletionProjections(ctx, projectID)
	if err != nil {
		return nil, err
	}
	result := make([]CompletionRecordView, 0, len(values))
	for _, value := range values {
		record := CompletionRecordView{ID: value.UUID, ProjectID: value.ProjectUUID, ClosingContractID: value.ClosingUUID, Title: value.Title, Summary: value.Summary, SmartContractID: value.SmartContractUUID, SmartContractVersion: value.SmartContractVersion, ReviewID: value.ReviewID, AIReviewVerdict: value.ReviewVerdict, RecordKind: value.RecordKind, UserVerdict: decodeJSON(value.UserVerdict, nil), CreatedAt: value.CreatedAt}
		record.CoveredContractIDs, err = s.decodePublicIDs(ctx, &value.CoveredIDs)
		if err != nil {
			return nil, err
		}
		result = append(result, record)
	}
	return result, nil
}

func (s *Service) decodePublicIDs(ctx context.Context, raw *string) ([]string, error) {
	if raw == nil || strings.TrimSpace(*raw) == "" {
		return []string{}, nil
	}
	var ids []uint64
	if err := json.Unmarshal([]byte(*raw), &ids); err != nil {
		return []string{}, nil
	}
	values, err := s.execution.UUIDByInternalIDs(ctx, ids)
	if err != nil {
		return nil, err
	}
	result := make([]string, 0, len(ids))
	for _, id := range ids {
		if value, ok := values[id]; ok {
			result = append(result, value)
		}
	}
	return result, nil
}

func decodeJSONPointer(value *string, fallback any) any {
	if value == nil || strings.TrimSpace(*value) == "" {
		return fallback
	}
	return decodeJSON(*value, fallback)
}
func decodeJSON(value string, fallback any) any {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	var decoded any
	if json.Unmarshal([]byte(value), &decoded) != nil {
		return fallback
	}
	return decoded
}
