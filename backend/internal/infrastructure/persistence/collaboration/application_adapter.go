package collaboration

import (
	"context"
	"errors"

	applicationcollaboration "github.com/singaurora/exec-graph/backend/internal/application/collaboration"
)

// ApplicationRepository adapts collaboration persistence to its application port.
type ApplicationRepository struct{ repository *Repository }

func NewApplicationRepository(repository *Repository) ApplicationRepository {
	return ApplicationRepository{repository: repository}
}

func (adapter ApplicationRepository) CreateCall(ctx context.Context, call *applicationcollaboration.CallRecord) error {
	model := CollaborationCall{ID: call.ID, UUID: call.UUID, ProjectID: call.ProjectID, TargetContractID: call.TargetContractID, CreatedBy: call.CreatedBy, Title: call.Title, Status: call.Status, MaxSubmissions: call.MaxSubmissions, CreatedAt: call.CreatedAt}
	if err := adapter.repository.CreateCall(ctx, &model); err != nil {
		return mapApplicationError(err)
	}
	call.ID, call.CreatedAt = model.ID, model.CreatedAt
	return nil
}

func (adapter ApplicationRepository) FindCallTarget(ctx context.Context, projectUUID, targetUUID string, ownerID uint64) (applicationcollaboration.TargetContextRecord, error) {
	value, err := adapter.repository.FindCallTarget(ctx, projectUUID, targetUUID, ownerID)
	return applicationcollaboration.TargetContextRecord{ProjectID: value.ProjectID, TargetContractID: value.TargetContractID, TargetTitle: value.TargetTitle, TargetStage: value.TargetStage, ProjectVisibility: value.ProjectVisibility}, mapApplicationError(err)
}

func (adapter ApplicationRepository) HasOpenCall(ctx context.Context, projectID, targetContractID uint64) (bool, error) {
	return adapter.repository.HasOpenCall(ctx, projectID, targetContractID)
}

func (adapter ApplicationRepository) ListPublicProjects(ctx context.Context) ([]applicationcollaboration.ProjectViewRecord, error) {
	values, err := adapter.repository.ListPublicProjects(ctx)
	return mapProjectViews(values), mapApplicationError(err)
}

func (adapter ApplicationRepository) FindPublicProject(ctx context.Context, projectUUID string) (applicationcollaboration.ProjectViewRecord, error) {
	value, err := adapter.repository.FindPublicProject(ctx, projectUUID)
	return mapProjectView(value), mapApplicationError(err)
}

func (adapter ApplicationRepository) ListCallIDs(ctx context.Context, projectUUID string) ([]string, error) {
	return adapter.repository.ListCallIDs(ctx, projectUUID)
}

func (adapter ApplicationRepository) FindCall(ctx context.Context, callUUID string) (applicationcollaboration.CallViewRecord, error) {
	value, err := adapter.repository.FindCall(ctx, callUUID)
	return mapCallView(value), mapApplicationError(err)
}

func (adapter ApplicationRepository) ListSubmissions(ctx context.Context, callUUID string, selected []string) ([]applicationcollaboration.SubmissionViewRecord, error) {
	values, err := adapter.repository.ListSubmissions(ctx, callUUID, selected)
	result := make([]applicationcollaboration.SubmissionViewRecord, 0, len(values))
	for _, value := range values {
		result = append(result, mapSubmissionView(value))
	}
	return result, mapApplicationError(err)
}

func (adapter ApplicationRepository) FindSourceOwner(ctx context.Context, recordUUID string) (uint64, error) {
	value, err := adapter.repository.FindSourceOwner(ctx, recordUUID)
	return value, mapApplicationError(err)
}

func (adapter ApplicationRepository) FindCallID(ctx context.Context, uuid string) (uint64, error) {
	value, err := adapter.repository.FindCallID(ctx, uuid)
	return value, mapApplicationError(err)
}

func (adapter ApplicationRepository) FindProjectID(ctx context.Context, uuid string) (uint64, error) {
	value, err := adapter.repository.FindProjectID(ctx, uuid)
	return value, mapApplicationError(err)
}

func (adapter ApplicationRepository) FindTargetID(ctx context.Context, uuid string) (uint64, error) {
	value, err := adapter.repository.FindTargetID(ctx, uuid)
	return value, mapApplicationError(err)
}

func (adapter ApplicationRepository) FindRecordID(ctx context.Context, uuid string) (uint64, error) {
	value, err := adapter.repository.FindRecordID(ctx, uuid)
	return value, mapApplicationError(err)
}

func (adapter ApplicationRepository) CreateSubmission(ctx context.Context, submission *applicationcollaboration.SubmissionRecord) error {
	model := CollaborationSubmission{ID: submission.ID, UUID: submission.UUID, CallID: submission.CallID, SourceRecordID: submission.SourceRecordID, ContributorID: submission.ContributorID, MappingText: submission.MappingText, Note: submission.Note, Status: submission.Status, CreatedAt: submission.CreatedAt, UpdatedAt: submission.UpdatedAt}
	if err := adapter.repository.CreateSubmission(ctx, &model); err != nil {
		return mapApplicationError(err)
	}
	submission.ID, submission.CreatedAt, submission.UpdatedAt = model.ID, model.CreatedAt, model.UpdatedAt
	return nil
}

func (adapter ApplicationRepository) FindReviewContext(ctx context.Context, projectUUID, targetUUID string) (applicationcollaboration.ReviewContextRecord, error) {
	value, err := adapter.repository.FindReviewContext(ctx, projectUUID, targetUUID)
	return applicationcollaboration.ReviewContextRecord{ProjectTitle: value.ProjectTitle, ProjectDescription: value.ProjectDescription, ProjectRules: value.ProjectRules, OriginalIntent: value.OriginalIntent, SmartContractID: value.SmartContractID, SmartContractName: value.SmartContractName, SmartContractDesc: value.SmartContractDesc, SmartContractBody: value.SmartContractBody}, mapApplicationError(err)
}

func (adapter ApplicationRepository) CreateReviewBatch(ctx context.Context, batch *applicationcollaboration.ReviewBatchRecord, submissionUUIDs []string) error {
	model := CollaborationReviewBatch{ID: batch.ID, UUID: batch.UUID, CallID: batch.CallID, ProjectID: batch.ProjectID, TargetContractID: batch.TargetContractID, CreatedBy: batch.CreatedBy, SubmissionIDsJSON: batch.SubmissionIDsJSON, AIReviewJSON: batch.AIReviewJSON, Status: batch.Status, CreatedAt: batch.CreatedAt, AdoptedAt: batch.AdoptedAt}
	if err := adapter.repository.CreateReviewBatch(ctx, &model, submissionUUIDs); err != nil {
		return mapApplicationError(err)
	}
	batch.ID, batch.SubmissionIDsJSON, batch.CreatedAt = model.ID, model.SubmissionIDsJSON, model.CreatedAt
	return nil
}

func (adapter ApplicationRepository) AdoptReview(ctx context.Context, batchUUID string, userID uint64) error {
	return mapApplicationError(adapter.repository.AdoptReview(ctx, batchUUID, userID))
}

func (adapter ApplicationRepository) ListContributionSources(ctx context.Context, userID uint64) ([]applicationcollaboration.ContributionSourceRecord, error) {
	values, err := adapter.repository.ListContributionSources(ctx, userID)
	result := make([]applicationcollaboration.ContributionSourceRecord, 0, len(values))
	for _, value := range values {
		result = append(result, applicationcollaboration.ContributionSourceRecord{ID: value.ID, Title: value.Title, Summary: value.Summary, ProjectTitle: value.ProjectTitle})
	}
	return result, mapApplicationError(err)
}

func (adapter ApplicationRepository) ListContributionActivities(ctx context.Context, userID uint64) ([]applicationcollaboration.ContributionActivityRecord, error) {
	values, err := adapter.repository.ListContributionActivities(ctx, userID)
	result := make([]applicationcollaboration.ContributionActivityRecord, 0, len(values))
	for _, value := range values {
		result = append(result, applicationcollaboration.ContributionActivityRecord{Submission: mapSubmissionView(value.Submission), Call: mapCallView(value.Call)})
	}
	return result, mapApplicationError(err)
}

func mapApplicationError(err error) error {
	switch {
	case errors.Is(err, ErrNotFound):
		return applicationcollaboration.ErrRecordNotFound
	case errors.Is(err, ErrInvalidState):
		return applicationcollaboration.ErrRecordInvalidState
	case errors.Is(err, ErrPartialUpdate):
		return applicationcollaboration.ErrRecordPartial
	case errors.Is(err, ErrCorruptBatch):
		return applicationcollaboration.ErrRecordCorrupt
	case errors.Is(err, ErrUnauthorized):
		return applicationcollaboration.ErrRecordUnauthorized
	default:
		return err
	}
}

func mapCallView(value CallView) applicationcollaboration.CallViewRecord {
	return applicationcollaboration.CallViewRecord{InternalID: value.InternalID, ID: value.ID, ProjectID: value.ProjectID, ProjectTitle: value.ProjectTitle, OwnerName: value.OwnerName, OwnerUserID: value.OwnerUserID, CreatedBy: value.CreatedBy, CreatedByUserID: value.CreatedByUserID, Title: value.Title, Status: value.Status, MaxSubmissions: value.MaxSubmissions, CreatedAt: value.CreatedAt, TargetID: value.TargetID, TargetTitle: value.TargetTitle, VerifiableGoal: value.VerifiableGoal, CriteriaJSON: value.CriteriaJSON, Evidence: value.Evidence, Stage: value.Stage, SubmissionCount: value.SubmissionCount}
}

func mapSubmissionView(value SubmissionView) applicationcollaboration.SubmissionViewRecord {
	return applicationcollaboration.SubmissionViewRecord{ID: value.ID, CallID: value.CallID, SourceRecordID: value.SourceRecordID, SourceTitle: value.SourceTitle, SourceSummary: value.SourceSummary, SourceProjectTitle: value.SourceProjectTitle, ContributorID: value.ContributorID, ContributorName: value.ContributorName, ContributorUserID: value.ContributorUserID, MappingText: value.MappingText, Note: value.Note, Status: value.Status, CreatedAt: value.CreatedAt}
}

func mapProjectView(value ProjectView) applicationcollaboration.ProjectViewRecord {
	return applicationcollaboration.ProjectViewRecord{ID: value.ID, Title: value.Title, Description: value.Description, OwnerName: value.OwnerName, OwnerUserID: value.OwnerUserID, NodeCount: value.NodeCount, AcceptedCount: value.AcceptedCount, OpenCallCount: value.OpenCallCount, UpdatedAt: value.UpdatedAt}
}

func mapProjectViews(values []ProjectView) []applicationcollaboration.ProjectViewRecord {
	result := make([]applicationcollaboration.ProjectViewRecord, 0, len(values))
	for _, value := range values {
		result = append(result, mapProjectView(value))
	}
	return result
}
