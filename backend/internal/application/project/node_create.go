package project

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
	sharedid "github.com/singaurora/exec-graph/backend/internal/shared/id"
)

// CreateExecutionNode 在行动草案被 AI 判定足够清楚后创建待推进节点。
func (s *Service) CreateExecutionNode(ctx context.Context, input CreateNodeInput) (CreateNodeResult, error) {
	input.Title = strings.TrimSpace(input.Title)
	input.Draft = strings.TrimSpace(input.Draft)
	input.VerifiableGoal = strings.TrimSpace(input.VerifiableGoal)
	input.EvidenceRequirement = strings.TrimSpace(input.EvidenceRequirement)
	input.RetryOfContractID = strings.TrimSpace(input.RetryOfContractID)
	input.SupplementOfNodeID = strings.TrimSpace(input.SupplementOfNodeID)
	if input.DraftReviewVerdict != "pass" {
		return CreateNodeResult{}, &ValidationError{"行动草案需要先经过 AI 辅助检查"}
	}
	if input.Title == "" || input.VerifiableGoal == "" || input.EvidenceRequirement == "" || input.Draft == "" || len(input.AcceptanceCriteria) == 0 {
		return CreateNodeResult{}, &ValidationError{"行动的目标、做到位清单或记录要求不完整"}
	}
	for _, criterion := range input.AcceptanceCriteria {
		if strings.TrimSpace(criterion.ID) == "" || strings.TrimSpace(criterion.Text) == "" || strings.TrimSpace(criterion.RequiredEvidence) == "" {
			return CreateNodeResult{}, &ValidationError{"行动做到位清单不完整"}
		}
	}
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	nodeID, err := sharedid.UUID()
	if err != nil {
		return CreateNodeResult{}, err
	}
	criteriaJSON, err := json.Marshal(input.AcceptanceCriteria)
	if err != nil {
		return CreateNodeResult{}, err
	}
	draftJSON, err := json.Marshal(input.DraftReview)
	if err != nil {
		return CreateNodeResult{}, err
	}
	configJSON, _ := json.Marshal(map[string]string{"keyUuid": input.DraftReviewKeyID})
	messageID, err := sharedid.UUID()
	if err != nil {
		return CreateNodeResult{}, err
	}
	messagesJSON, _ := json.Marshal([]map[string]any{{"uuid": messageID, "speaker": "ai", "body": "行动草案已经足够清楚，目标、做到位清单和记录要求已保存。接下来请记录现实中的推进。", "createdAt": time.Now()}})
	project, err := s.GetOwnedProject(ctx, input.OwnerID, input.ProjectID)
	if err != nil {
		return CreateNodeResult{}, err
	}
	sourceIDs := uniqueNonEmpty(input.SourceContractIDs)
	if len(sourceIDs) == 0 && input.ParentContractID != "" {
		sourceIDs = []string{input.ParentContractID}
	}
	sourceJSON, _ := json.Marshal(sourceIDs)
	err = s.execution.CreateNode(ctx, CreateNodeRecord{OwnerID: input.OwnerID, ProjectID: input.ProjectID, NodeID: nodeID, Title: input.Title, Draft: input.Draft, Goal: input.VerifiableGoal, CriteriaJSON: string(criteriaJSON), EvidenceRequirement: input.EvidenceRequirement, DraftReviewJSON: string(draftJSON), DraftAIConfigJSON: string(configJSON), MessagesJSON: string(messagesJSON), SourceIDsJSON: string(sourceJSON), ParentID: input.ParentContractID, SupplementID: input.SupplementOfNodeID, RetryID: input.RetryOfContractID, PlanningConversationID: input.PlanningConversationID, BranchID: input.BranchID, EdgeType: "lineage", SourceIDs: sourceIDs, Visibility: project.Visibility, Fork: input.Fork, Closure: input.Closure, Supplement: input.SupplementOfNodeID != "", CreateBranch: input.Fork})
	if err != nil {
		return CreateNodeResult{}, err
	}
	state, err := s.GetProjectExecutionState(ctx, input.OwnerID, input.ProjectID)
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
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}
