package collaboration

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	persistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/collaboration"
	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
	sharedid "github.com/singaurora/exec-graph/backend/internal/shared/id"
)

type Service struct {
	repository *persistence.Repository
}

func New(repository *persistence.Repository) *Service { return &Service{repository: repository} }

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
	target, err := s.repository.FindCallTarget(ctx, input.ProjectID, input.TargetContractID, input.OwnerID)
	if errors.Is(err, persistence.ErrNotFound) {
		return Call{}, ErrNotFound
	}
	if err != nil {
		return Call{}, err
	}
	if target.ProjectVisibility != "public" {
		return Call{}, ErrProjectPrivate
	}
	if target.TargetStage != "frozen" {
		return Call{}, ErrTargetNotReady
	}
	if input.Title == "" {
		input.Title = target.TargetTitle
	}
	exists, err := s.repository.HasOpenCall(ctx, target.ProjectID, target.TargetContractID)
	if err != nil {
		return Call{}, err
	}
	if exists {
		return Call{}, ErrCallExists
	}
	id, err := sharedid.Opaque("call")
	if err != nil {
		return Call{}, err
	}
	if err := s.repository.CreateCall(ctx, &persistence.CollaborationCall{
		UUID: id, ProjectID: target.ProjectID, TargetContractID: target.TargetContractID,
		CreatedBy: input.OwnerID, Title: input.Title, MaxSubmissions: input.MaxSubmissions,
		Status: "open",
	}); err != nil {
		return Call{}, err
	}
	return s.GetCall(ctx, id)
}

func (s *Service) ListExplore(ctx context.Context) ([]ExploreProject, error) {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	projects, err := s.repository.ListPublicProjects(ctx)
	if err != nil {
		return nil, err
	}
	result := make([]ExploreProject, 0, len(projects))
	for _, project := range projects {
		item, err := s.projectView(ctx, project)
		if err != nil {
			return nil, err
		}
		result = append(result, item)
	}
	return result, nil
}

func (s *Service) GetProject(ctx context.Context, projectID string) (ExploreProject, error) {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	project, err := s.repository.FindPublicProject(ctx, strings.TrimSpace(projectID))
	if errors.Is(err, persistence.ErrNotFound) {
		return ExploreProject{}, ErrNotFound
	}
	if err != nil {
		return ExploreProject{}, err
	}
	return s.projectView(ctx, project)
}

func (s *Service) projectView(ctx context.Context, project persistence.ProjectView) (ExploreProject, error) {
	ids, err := s.repository.ListCallIDs(ctx, project.ID)
	if err != nil {
		return ExploreProject{}, err
	}
	calls := make([]Call, 0, len(ids))
	for _, id := range ids {
		call, err := s.GetCall(ctx, id)
		if err != nil {
			return ExploreProject{}, err
		}
		calls = append(calls, call)
	}
	return ExploreProject{ID: project.ID, Title: project.Title, Description: project.Description,
		OwnerName: project.OwnerName, OwnerUserID: project.OwnerUserID, NodeCount: project.NodeCount,
		AcceptedCount: project.AcceptedCount, OpenCallCount: project.OpenCallCount, Calls: calls}, nil
}

func (s *Service) ListCalls(ctx context.Context, projectID string) ([]Call, error) {
	ids, err := s.repository.ListCallIDs(ctx, projectID)
	if err != nil {
		return nil, err
	}
	calls := make([]Call, 0, len(ids))
	for _, id := range ids {
		call, err := s.GetCall(ctx, id)
		if err != nil {
			return nil, err
		}
		calls = append(calls, call)
	}
	return calls, nil
}

func (s *Service) GetCall(ctx context.Context, id string) (Call, error) {
	view, err := s.repository.FindCall(ctx, strings.TrimSpace(id))
	if errors.Is(err, persistence.ErrNotFound) {
		return Call{}, ErrNotFound
	}
	if err != nil {
		return Call{}, err
	}
	return mapCall(view), nil
}

func (s *Service) GetCallDetails(ctx context.Context, id string) (CallDetails, error) {
	call, err := s.GetCall(ctx, id)
	if err != nil {
		return CallDetails{}, err
	}
	submissions, err := s.ListSubmissions(ctx, id, nil)
	if err != nil {
		return CallDetails{}, err
	}
	return CallDetails{Call: call, Submissions: submissions}, nil
}

func (s *Service) ListSubmissions(ctx context.Context, callID string, selected []string) ([]Submission, error) {
	items, err := s.repository.ListSubmissions(ctx, callID, selected)
	if err != nil {
		return nil, err
	}
	result := make([]Submission, 0, len(items))
	for _, item := range items {
		result = append(result, mapSubmission(item))
	}
	return result, nil
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
	ownerID, err := s.repository.FindSourceOwner(ctx, input.SourceRecordID)
	if errors.Is(err, persistence.ErrNotFound) || ownerID != input.UserID {
		return CallDetails{}, ErrSubmissionInvalid
	}
	if err != nil {
		return CallDetails{}, err
	}
	callID, err := s.repository.FindCallID(ctx, input.CallID)
	if err != nil {
		return CallDetails{}, err
	}
	recordID, err := s.repository.FindRecordID(ctx, input.SourceRecordID)
	if err != nil {
		return CallDetails{}, ErrSubmissionInvalid
	}
	id, err := sharedid.Opaque("contribution")
	if err != nil {
		return CallDetails{}, err
	}
	err = s.repository.CreateSubmission(ctx, &persistence.CollaborationSubmission{
		UUID: id, CallID: callID, SourceRecordID: recordID, ContributorID: input.UserID,
		MappingText: input.MappingText, Note: input.Note, Status: "submitted",
	})
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "duplicate") {
			return CallDetails{}, ErrDuplicateSubmission
		}
		return CallDetails{}, err
	}
	return s.GetCallDetails(ctx, input.CallID)
}

// CreateReviewBatch persists the AI result after the HTTP layer has completed
// the external model call. The review itself is application data, not SQL.
func (s *Service) CreateReviewBatch(ctx context.Context, input CreateReviewBatchInput) error {
	call, err := s.GetCall(ctx, input.CallID)
	if err != nil {
		return err
	}
	if call.CreatedBy != input.UserID || call.Status != "open" || call.Target.Stage != "frozen" {
		return ErrInvalidRequest
	}
	callID, err := s.repository.FindCallID(ctx, input.CallID)
	if err != nil {
		return err
	}
	projectID, err := s.repository.FindProjectID(ctx, call.ProjectID)
	if err != nil {
		return err
	}
	targetID, err := s.repository.FindTargetID(ctx, call.Target.ID)
	if err != nil {
		return err
	}
	batch := &persistence.CollaborationReviewBatch{UUID: input.BatchID, CallID: callID, ProjectID: projectID, TargetContractID: targetID, CreatedBy: input.UserID, AIReviewJSON: input.ReviewJSON, Status: input.Status}
	if batch.CallID == 0 || batch.ProjectID == 0 || batch.TargetContractID == 0 {
		return ErrNotFound
	}
	return s.repository.CreateReviewBatch(ctx, batch, input.SubmissionIDs)
}

func (s *Service) ReviewContext(ctx context.Context, projectID, targetID string) (ReviewContext, error) {
	value, err := s.repository.FindReviewContext(ctx, projectID, targetID)
	if errors.Is(err, persistence.ErrNotFound) {
		return ReviewContext{}, ErrNotFound
	}
	return ReviewContext{ProjectTitle: value.ProjectTitle, ProjectDescription: value.ProjectDescription, ProjectRules: value.ProjectRules, OriginalIntent: value.OriginalIntent, SmartContractID: value.SmartContractID, SmartContractName: value.SmartContractName, SmartContractDesc: value.SmartContractDesc, SmartContractBody: value.SmartContractBody}, err
}

func (s *Service) AdoptReview(ctx context.Context, input AdoptReviewInput) error {
	err := s.repository.AdoptReview(ctx, input.BatchID, input.UserID)
	if errors.Is(err, persistence.ErrNotFound) {
		return ErrNotFound
	}
	if errors.Is(err, persistence.ErrInvalidState) || errors.Is(err, persistence.ErrPartialUpdate) || errors.Is(err, persistence.ErrCorruptBatch) {
		return ErrInvalidRequest
	}
	if errors.Is(err, persistence.ErrUnauthorized) {
		return ErrUnauthorized
	}
	return err
}

func (s *Service) ListContributionSources(ctx context.Context, userID uint64) ([]ContributionSource, error) {
	items, err := s.repository.ListContributionSources(ctx, userID)
	if err != nil {
		return nil, err
	}
	result := make([]ContributionSource, 0, len(items))
	for _, item := range items {
		result = append(result, ContributionSource{ID: item.ID, Title: item.Title, Summary: item.Summary, ProjectTitle: item.ProjectTitle})
	}
	return result, nil
}

func (s *Service) ListContributionActivities(ctx context.Context, userID uint64) ([]ContributionActivity, error) {
	items, err := s.repository.ListContributionActivities(ctx, userID)
	if err != nil {
		return nil, err
	}
	result := make([]ContributionActivity, 0, len(items))
	for _, item := range items {
		result = append(result, ContributionActivity{Submission: mapSubmission(item.Submission), Call: mapCall(item.Call)})
	}
	return result, nil
}

func mapCall(view persistence.CallView) Call {
	var criteria []Criterion
	_ = json.Unmarshal([]byte(view.CriteriaJSON), &criteria)
	return Call{ID: view.ID, ProjectID: view.ProjectID, ProjectTitle: view.ProjectTitle, OwnerName: view.OwnerName, OwnerUserID: view.OwnerUserID, CreatedBy: view.CreatedBy, Title: view.Title, Status: view.Status, MaxSubmissions: view.MaxSubmissions, SubmissionCount: view.SubmissionCount, Target: Target{ID: view.TargetID, Title: view.TargetTitle, VerifiableGoal: view.VerifiableGoal, AcceptanceCriteria: criteria, EvidenceRequirement: view.Evidence, Stage: view.Stage}, CreatedAt: view.CreatedAt}
}

func mapSubmission(view persistence.SubmissionView) Submission {
	return Submission{ID: view.ID, CallID: view.CallID, SourceRecordID: view.SourceRecordID, SourceTitle: view.SourceTitle, SourceSummary: view.SourceSummary, SourceProjectTitle: view.SourceProjectTitle, ContributorID: view.ContributorID, ContributorName: view.ContributorName, ContributorUserID: view.ContributorUserID, MappingText: view.MappingText, Note: view.Note, Status: view.Status, CreatedAt: view.CreatedAt}
}
