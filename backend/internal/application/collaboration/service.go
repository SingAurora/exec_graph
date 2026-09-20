package collaboration

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	applicationaigateway "github.com/singaurora/exec-graph/backend/internal/application/aigateway"
	applicationaikey "github.com/singaurora/exec-graph/backend/internal/application/aikey"
	applicationreview "github.com/singaurora/exec-graph/backend/internal/application/review"
	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
	sharedid "github.com/singaurora/exec-graph/backend/internal/shared/id"
)

type Service struct {
	repository  Repository
	credentials CredentialProvider
	reviewer    *applicationreview.Service
}

// New 创建协作应用服务。
func New(dependencies Dependencies) *Service {
	return &Service{repository: dependencies.Repository, credentials: dependencies.Credentials, reviewer: dependencies.Reviewer}
}

// PublishCollaborationCall 为公开项目的冻结节点发布协作征集。
func (s *Service) PublishCollaborationCall(ctx context.Context, input CreateCallInput) (Call, error) {
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
	if errors.Is(err, ErrRecordNotFound) {
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
	id, err := sharedid.UUID()
	if err != nil {
		return Call{}, err
	}
	if err := s.repository.CreateCall(ctx, &CallRecord{
		UUID: id, ProjectID: target.ProjectID, TargetContractID: target.TargetContractID,
		CreatedBy: input.OwnerID, Title: input.Title, MaxSubmissions: input.MaxSubmissions,
		Status: "open",
	}); err != nil {
		return Call{}, err
	}
	return s.GetCollaborationCall(ctx, id)
}

// ListPublicProjects 返回公开探索页可展示的项目。
func (s *Service) ListPublicProjects(ctx context.Context) ([]ExploreProject, error) {
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

// GetPublicProject 返回一个公开项目的协作视图。
func (s *Service) GetPublicProject(ctx context.Context, projectID string) (ExploreProject, error) {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	project, err := s.repository.FindPublicProject(ctx, strings.TrimSpace(projectID))
	if errors.Is(err, ErrRecordNotFound) {
		return ExploreProject{}, ErrNotFound
	}
	if err != nil {
		return ExploreProject{}, err
	}
	return s.projectView(ctx, project)
}

func (s *Service) projectView(ctx context.Context, project ProjectViewRecord) (ExploreProject, error) {
	ids, err := s.repository.ListCallIDs(ctx, project.ID)
	if err != nil {
		return ExploreProject{}, err
	}
	calls := make([]Call, 0, len(ids))
	for _, id := range ids {
		call, err := s.GetCollaborationCall(ctx, id)
		if err != nil {
			return ExploreProject{}, err
		}
		calls = append(calls, call)
	}
	return ExploreProject{ID: project.ID, Title: project.Title, Description: project.Description,
		OwnerName: project.OwnerName, OwnerUserID: project.OwnerUserID, NodeCount: project.NodeCount,
		AcceptedCount: project.AcceptedCount, OpenCallCount: project.OpenCallCount, Calls: calls}, nil
}

// ListProjectCollaborationCalls 返回指定项目发布的协作征集。
func (s *Service) ListProjectCollaborationCalls(ctx context.Context, projectID string) ([]Call, error) {
	ids, err := s.repository.ListCallIDs(ctx, projectID)
	if err != nil {
		return nil, err
	}
	calls := make([]Call, 0, len(ids))
	for _, id := range ids {
		call, err := s.GetCollaborationCall(ctx, id)
		if err != nil {
			return nil, err
		}
		calls = append(calls, call)
	}
	return calls, nil
}

// GetCollaborationCall 返回一份协作征集的目标和状态。
func (s *Service) GetCollaborationCall(ctx context.Context, id string) (Call, error) {
	view, err := s.repository.FindCall(ctx, strings.TrimSpace(id))
	if errors.Is(err, ErrRecordNotFound) {
		return Call{}, ErrNotFound
	}
	if err != nil {
		return Call{}, err
	}
	return mapCall(view), nil
}

// GetCollaborationCallDetails 返回协作征集及其全部投稿。
func (s *Service) GetCollaborationCallDetails(ctx context.Context, id string) (CallDetails, error) {
	call, err := s.GetCollaborationCall(ctx, id)
	if err != nil {
		return CallDetails{}, err
	}
	submissions, err := s.ListContributionSubmissions(ctx, id, nil)
	if err != nil {
		return CallDetails{}, err
	}
	return CallDetails{Call: call, Submissions: submissions}, nil
}

// ListContributionSubmissions 返回协作征集中的投稿，可按编号筛选。
func (s *Service) ListContributionSubmissions(ctx context.Context, callID string, selected []string) ([]Submission, error) {
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

// SubmitProjectContribution 将一份已有成果提交给协作征集。
func (s *Service) SubmitProjectContribution(ctx context.Context, input SubmitInput) (CallDetails, error) {
	input.CallID = strings.TrimSpace(input.CallID)
	input.SourceRecordID = strings.TrimSpace(input.SourceRecordID)
	input.MappingText = strings.TrimSpace(input.MappingText)
	input.Note = strings.TrimSpace(input.Note)
	if input.SourceRecordID == "" || len([]rune(input.MappingText)) < 8 {
		return CallDetails{}, ErrSubmissionInvalid
	}
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	call, err := s.GetCollaborationCall(ctx, input.CallID)
	if err != nil {
		return CallDetails{}, err
	}
	if call.Status != "open" || call.Target.Stage != "frozen" || call.SubmissionCount >= call.MaxSubmissions {
		return CallDetails{}, ErrSubmissionInvalid
	}
	ownerID, err := s.repository.FindSourceOwner(ctx, input.SourceRecordID)
	if errors.Is(err, ErrRecordNotFound) || ownerID != input.UserID {
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
	id, err := sharedid.UUID()
	if err != nil {
		return CallDetails{}, err
	}
	err = s.repository.CreateSubmission(ctx, &SubmissionRecord{
		UUID: id, CallID: callID, SourceRecordID: recordID, ContributorID: input.UserID,
		MappingText: input.MappingText, Note: input.Note, Status: "submitted",
	})
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "duplicate") {
			return CallDetails{}, ErrDuplicateSubmission
		}
		return CallDetails{}, err
	}
	return s.GetCollaborationCallDetails(ctx, input.CallID)
}

// CreateContributionReviewBatch 在外部模型调用完成后保存组合审查结果。
func (s *Service) CreateContributionReviewBatch(ctx context.Context, input CreateReviewBatchInput) error {
	call, err := s.GetCollaborationCall(ctx, input.CallID)
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
	batch := &ReviewBatchRecord{UUID: input.BatchID, CallID: callID, ProjectID: projectID, TargetContractID: targetID, CreatedBy: input.UserID, AIReviewJSON: input.ReviewJSON, Status: input.Status}
	if batch.CallID == 0 || batch.ProjectID == 0 || batch.TargetContractID == 0 {
		return ErrNotFound
	}
	return s.repository.CreateReviewBatch(ctx, batch, input.SubmissionIDs)
}

// ReviewContributionBatch 按目标节点标准审查选中的贡献组合并保存审查批次。
func (s *Service) ReviewContributionBatch(ctx context.Context, userID uint64, callID string, submissionIDs []string) (ReviewBatch, error) {
	callID = strings.TrimSpace(callID)
	submissionIDs = uniqueNonEmpty(submissionIDs)
	if callID == "" || len(submissionIDs) == 0 {
		return ReviewBatch{}, ErrInvalidRequest
	}
	call, err := s.GetCollaborationCall(ctx, callID)
	if err != nil {
		return ReviewBatch{}, err
	}
	if call.CreatedBy != userID {
		return ReviewBatch{}, ErrUnauthorized
	}
	if call.Status != "open" || call.Target.Stage != "frozen" {
		return ReviewBatch{}, ErrInvalidRequest
	}
	submissions, err := s.ListContributionSubmissions(ctx, callID, submissionIDs)
	if err != nil {
		return ReviewBatch{}, err
	}
	if len(submissions) != len(submissionIDs) {
		return ReviewBatch{}, ErrInvalidRequest
	}
	request, err := s.collaborationReviewRequest(ctx, call, submissions)
	if err != nil {
		return ReviewBatch{}, err
	}
	key, err := s.credentials.FindProjectReviewKey(ctx, userID, call.ProjectID)
	if errors.Is(err, applicationaikey.ErrNotFound) {
		return ReviewBatch{}, fault.New(fault.InvalidRequest, "请先为项目选择审查 AI")
	}
	if err != nil {
		return ReviewBatch{}, fault.Wrap(fault.Internal, "读取项目审查 AI 失败", err)
	}
	configuration := applicationreview.ModelConfiguration{
		Credential: applicationaigateway.Credential{Provider: key.Provider, APIKey: key.Secret, BaseURL: key.BaseURL, Model: key.Model},
		Snapshot:   applicationreview.AIConfigSnapshot{KeyID: key.ID, Label: key.Label, Provider: key.Provider, Model: key.Model, BaseURL: key.BaseURL},
	}
	review, err := s.reviewer.ReviewCompletion(ctx, configuration, request)
	if err != nil {
		return ReviewBatch{}, fault.Wrap(fault.UpstreamFailure, err.Error(), err)
	}
	batchID, err := sharedid.UUID()
	if err != nil {
		return ReviewBatch{}, fault.Wrap(fault.Internal, "创建组合审查失败", err)
	}
	reviewBytes, err := json.Marshal(review)
	if err != nil {
		return ReviewBatch{}, fault.Wrap(fault.Internal, "保存组合审查失败", err)
	}
	status := "reviewed_gap"
	if review.Verdict == "pass" {
		status = "reviewed_pass"
	}
	if err := s.credentials.MarkAIKeyUsed(ctx, userID, key.ID); err != nil {
		return ReviewBatch{}, fault.Wrap(fault.Internal, "保存 AI 使用记录失败", err)
	}
	if err := s.CreateContributionReviewBatch(ctx, CreateReviewBatchInput{UserID: userID, BatchID: batchID, CallID: callID, SubmissionIDs: submissionIDs, ReviewJSON: string(reviewBytes), Status: status}); err != nil {
		return ReviewBatch{}, fault.Wrap(fault.Internal, "保存组合审查失败", err)
	}
	return ReviewBatch{ID: batchID, CallID: callID, SubmissionIDs: submissionIDs, Review: review, Status: status, CreatedAt: time.Now()}, nil
}

func (s *Service) collaborationReviewRequest(ctx context.Context, call Call, submissions []Submission) (applicationreview.CompletionRequest, error) {
	request := applicationreview.CompletionRequest{
		NodeID: call.Target.ID, Title: call.Target.Title, VerifiableGoal: call.Target.VerifiableGoal,
		EvidenceRequirement: call.Target.EvidenceRequirement,
		AcceptanceCriteria:  make([]applicationreview.Criterion, 0, len(call.Target.AcceptanceCriteria)),
	}
	for _, criterion := range call.Target.AcceptanceCriteria {
		request.AcceptanceCriteria = append(request.AcceptanceCriteria, applicationreview.Criterion{ID: criterion.ID, Text: criterion.Text, RequiredEvidence: criterion.RequiredEvidence})
	}
	reviewContext, err := s.GetContributionReviewContext(ctx, call.ProjectID, call.Target.ID)
	if err != nil {
		return request, err
	}
	request.Project = applicationreview.Project{ID: call.ProjectID, Title: reviewContext.ProjectTitle, Description: reviewContext.ProjectDescription, ProjectRules: reviewContext.ProjectRules}
	request.OriginalIntent = reviewContext.OriginalIntent
	request.SmartContract = applicationreview.SmartContract{ID: reviewContext.SmartContractID, Name: reviewContext.SmartContractName, Description: reviewContext.SmartContractDesc, Body: reviewContext.SmartContractBody}
	request.CompletionClaim = fmt.Sprintf("项目维护者选择了 %d 份外部已锁定成果，申请作为「%s」的组合证据。", len(submissions), call.Target.Title)
	parts := make([]string, 0, len(submissions))
	for _, submission := range submissions {
		parts = append(parts, fmt.Sprintf("来源成果：%s（%s / @%s）\n成果摘要：%s\n贡献者映射：%s\n补充说明：%s", submission.SourceTitle, submission.SourceProjectTitle, submission.ContributorUserID, submission.SourceSummary, submission.MappingText, submission.Note))
	}
	request.EvidenceText = strings.Join(parts, "\n\n---\n\n")
	return request, nil
}

// GetContributionReviewContext 返回组合审查需要的目标项目和合约上下文。
func (s *Service) GetContributionReviewContext(ctx context.Context, projectID, targetID string) (ReviewContext, error) {
	value, err := s.repository.FindReviewContext(ctx, projectID, targetID)
	if errors.Is(err, ErrRecordNotFound) {
		return ReviewContext{}, ErrNotFound
	}
	return ReviewContext{ProjectTitle: value.ProjectTitle, ProjectDescription: value.ProjectDescription, ProjectRules: value.ProjectRules, OriginalIntent: value.OriginalIntent, SmartContractID: value.SmartContractID, SmartContractName: value.SmartContractName, SmartContractDesc: value.SmartContractDesc, SmartContractBody: value.SmartContractBody}, err
}

// AdoptReviewedContributions 将通过审查的一组贡献正式纳入目标项目。
func (s *Service) AdoptReviewedContributions(ctx context.Context, input AdoptReviewInput) error {
	err := s.repository.AdoptReview(ctx, input.BatchID, input.UserID)
	if errors.Is(err, ErrRecordNotFound) {
		return ErrNotFound
	}
	if errors.Is(err, ErrRecordInvalidState) || errors.Is(err, ErrRecordPartial) || errors.Is(err, ErrRecordCorrupt) {
		return ErrInvalidRequest
	}
	if errors.Is(err, ErrRecordUnauthorized) {
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

func mapCall(view CallViewRecord) Call {
	var criteria []Criterion
	_ = json.Unmarshal([]byte(view.CriteriaJSON), &criteria)
	return Call{ID: view.ID, ProjectID: view.ProjectID, ProjectTitle: view.ProjectTitle, OwnerName: view.OwnerName, OwnerUserID: view.OwnerUserID, CreatedBy: view.CreatedBy, CreatedByUserID: view.CreatedByUserID, Title: view.Title, Status: view.Status, MaxSubmissions: view.MaxSubmissions, SubmissionCount: view.SubmissionCount, Target: Target{ID: view.TargetID, Title: view.TargetTitle, VerifiableGoal: view.VerifiableGoal, AcceptanceCriteria: criteria, EvidenceRequirement: view.Evidence, Stage: view.Stage}, CreatedAt: view.CreatedAt}
}

func mapSubmission(view SubmissionViewRecord) Submission {
	return Submission{ID: view.ID, CallID: view.CallID, SourceRecordID: view.SourceRecordID, SourceTitle: view.SourceTitle, SourceSummary: view.SourceSummary, SourceProjectTitle: view.SourceProjectTitle, ContributorID: view.ContributorID, ContributorName: view.ContributorName, ContributorUserID: view.ContributorUserID, MappingText: view.MappingText, Note: view.Note, Status: view.Status, CreatedAt: view.CreatedAt}
}

func uniqueNonEmpty(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
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
