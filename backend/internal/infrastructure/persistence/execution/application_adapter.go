package execution

import (
	"context"

	applicationproject "github.com/singaurora/exec-graph/backend/internal/application/project"
)

// ApplicationRepository adapts execution persistence to the project application port.
type ApplicationRepository struct{ repository *Repository }

func NewApplicationRepository(repository *Repository) ApplicationRepository {
	return ApplicationRepository{repository: repository}
}

func (adapter ApplicationRepository) CreateNode(ctx context.Context, input applicationproject.CreateNodeRecord) error {
	return adapter.repository.CreateNode(ctx, CreateNodeParams{
		OwnerID: input.OwnerID, ProjectID: input.ProjectID, NodeID: input.NodeID, Title: input.Title,
		Draft: input.Draft, Goal: input.Goal, CriteriaJSON: input.CriteriaJSON, EvidenceRequirement: input.EvidenceRequirement,
		DraftReviewJSON: input.DraftReviewJSON, DraftAIConfigJSON: input.DraftAIConfigJSON,
		MessagesJSON: input.MessagesJSON, SourceIDsJSON: input.SourceIDsJSON, ParentID: input.ParentID,
		SupplementID: input.SupplementID, RetryID: input.RetryID, PlanningConversationID: input.PlanningConversationID,
		BranchID: input.BranchID, EdgeType: input.EdgeType, SourceIDs: input.SourceIDs, Visibility: input.Visibility,
		Fork: input.Fork, Closure: input.Closure, Supplement: input.Supplement, CreateBranch: input.CreateBranch,
	})
}

func (adapter ApplicationRepository) LockNode(ctx context.Context, input applicationproject.LockNodeRecord) error {
	return adapter.repository.LockNode(ctx, LockNodeParams{
		UserID: input.UserID, ProjectID: input.ProjectID, NodeID: input.NodeID, RecordID: input.RecordID,
		ReviewID: input.ReviewID, ReviewVerdict: input.ReviewVerdict, Title: input.Title, Summary: input.Summary,
		SmartContractVersion: input.SmartContractVersion, RecordKind: input.RecordKind, TerminalStage: input.TerminalStage,
		VerdictJSON: input.VerdictJSON, MessagesJSON: input.MessagesJSON, CoveredIDsJSON: input.CoveredIDsJSON,
	})
}

func (adapter ApplicationRepository) ListNodeProjections(ctx context.Context, projectUUID string) ([]applicationproject.NodeRecord, error) {
	values, err := adapter.repository.ListNodeProjections(ctx, projectUUID)
	if err != nil {
		return nil, err
	}
	result := make([]applicationproject.NodeRecord, 0, len(values))
	for _, value := range values {
		result = append(result, applicationproject.NodeRecord{
			UUID: value.UUID, BranchUUID: value.BranchUUID, RevisionUUID: value.RevisionUUID, ParentUUID: value.ParentUUID,
			SourceIDs: value.SourceIDs, SupplementUUID: value.SupplementUUID, RetryUUID: value.RetryUUID,
			ActorUserID: value.ActorUserID, Title: value.Title, Stage: value.Stage, OriginalIntent: value.OriginalIntent,
			SmartContractUUID: value.SmartContractUUID, SmartContractVersion: value.SmartContractVersion,
			Goal: value.Goal, Criteria: value.Criteria, EvidenceRequirement: value.EvidenceRequirement,
			Claim: value.Claim, Evidence: value.Evidence, StartedAt: value.StartedAt, EndedAt: value.EndedAt,
			RecordUUID: value.RecordUUID, DraftReview: value.DraftReview, DraftAI: value.DraftAI,
			ReviewMessages: value.ReviewMessages, AIReview: value.AIReview, CompletionAI: value.CompletionAI,
			ReviewRounds: value.ReviewRounds, PlanningUUID: value.PlanningUUID, CompletionUUID: value.CompletionUUID,
			Verdict: value.Verdict, NextTitle: value.NextTitle, CreatedAt: value.CreatedAt, UpdatedAt: value.UpdatedAt,
		})
	}
	return result, nil
}

func (adapter ApplicationRepository) ListEdgeProjections(ctx context.Context) ([]applicationproject.EdgeRecord, error) {
	values, err := adapter.repository.ListEdgeProjections(ctx)
	result := make([]applicationproject.EdgeRecord, 0, len(values))
	for _, value := range values {
		result = append(result, applicationproject.EdgeRecord{UUID: value.UUID, SourceUUID: value.SourceUUID, TargetUUID: value.TargetUUID, Type: value.Type, CreatedAt: value.CreatedAt})
	}
	return result, err
}

func (adapter ApplicationRepository) ListBranchProjections(ctx context.Context, projectUUID string) ([]applicationproject.BranchRecord, error) {
	values, err := adapter.repository.ListBranchProjections(ctx, projectUUID)
	result := make([]applicationproject.BranchRecord, 0, len(values))
	for _, value := range values {
		result = append(result, applicationproject.BranchRecord{UUID: value.UUID, ProjectUUID: value.ProjectUUID, Title: value.Title, RootUUID: value.RootUUID, ForkedUUID: value.ForkedUUID, HeadUUID: value.HeadUUID, CurrentUUID: value.CurrentUUID, CreatedByUserID: value.CreatedByUserID, CreatedAt: value.CreatedAt})
	}
	return result, err
}

func (adapter ApplicationRepository) ListCompletionProjections(ctx context.Context, projectUUID string) ([]applicationproject.CompletionRecord, error) {
	values, err := adapter.repository.ListCompletionProjections(ctx, projectUUID)
	result := make([]applicationproject.CompletionRecord, 0, len(values))
	for _, value := range values {
		result = append(result, applicationproject.CompletionRecord{UUID: value.UUID, ProjectUUID: value.ProjectUUID, ClosingUUID: value.ClosingUUID, CoveredIDs: value.CoveredIDs, Title: value.Title, Summary: value.Summary, SmartContractUUID: value.SmartContractUUID, SmartContractVersion: value.SmartContractVersion, ReviewID: value.ReviewID, ReviewVerdict: value.ReviewVerdict, RecordKind: value.RecordKind, UserVerdict: value.UserVerdict, CreatedAt: value.CreatedAt})
	}
	return result, err
}

func (adapter ApplicationRepository) UUIDByInternalIDs(ctx context.Context, ids []uint64) (map[uint64]string, error) {
	return adapter.repository.UUIDByInternalIDs(ctx, ids)
}
