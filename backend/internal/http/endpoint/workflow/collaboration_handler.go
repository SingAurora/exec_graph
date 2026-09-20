package workflow

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	applicationcollaboration "github.com/singaurora/exec-graph/backend/internal/application/collaboration"
	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
)

type collaborationTargetResponse struct {
	ID                  string                   `json:"id"`
	Title               string                   `json:"title"`
	VerifiableGoal      string                   `json:"verifiableGoal"`
	AcceptanceCriteria  []reviewCriterionRequest `json:"acceptanceCriteria"`
	EvidenceRequirement string                   `json:"evidenceRequirement"`
	Stage               string                   `json:"stage"`
}

type collaborationCallResponse struct {
	ID              string                      `json:"id"`
	ProjectID       string                      `json:"projectId"`
	ProjectTitle    string                      `json:"projectTitle"`
	OwnerName       string                      `json:"ownerName"`
	OwnerUserID     string                      `json:"ownerUserId"`
	CreatedBy       uint64                      `json:"createdBy"`
	Title           string                      `json:"title"`
	Status          string                      `json:"status"`
	MaxSubmissions  int                         `json:"maxSubmissions"`
	SubmissionCount int                         `json:"submissionCount"`
	Target          collaborationTargetResponse `json:"target"`
	CreatedAt       time.Time                   `json:"createdAt"`
}

type collaborationSubmissionResponse struct {
	ID                 string    `json:"id"`
	CallID             string    `json:"callId"`
	SourceRecordID     string    `json:"sourceRecordId"`
	SourceTitle        string    `json:"sourceTitle"`
	SourceSummary      string    `json:"sourceSummary"`
	SourceProjectTitle string    `json:"sourceProjectTitle"`
	ContributorID      uint64    `json:"contributorId"`
	ContributorName    string    `json:"contributorName"`
	ContributorUserID  string    `json:"contributorUserId"`
	MappingText        string    `json:"mappingText"`
	Note               string    `json:"note,omitempty"`
	Status             string    `json:"status"`
	CreatedAt          time.Time `json:"createdAt"`
}

type collaborationReviewBatchResponse struct {
	ID            string           `json:"id"`
	CallID        string           `json:"callId"`
	SubmissionIDs []string         `json:"submissionIds"`
	Review        aiReviewResponse `json:"review"`
	Status        string           `json:"status"`
	CreatedAt     time.Time        `json:"createdAt"`
	AdoptedAt     *time.Time       `json:"adoptedAt,omitempty"`
}

type exploreProjectResponse struct {
	ID            string                      `json:"id"`
	Title         string                      `json:"title"`
	Description   string                      `json:"description"`
	OwnerName     string                      `json:"ownerName"`
	OwnerUserID   string                      `json:"ownerUserId"`
	NodeCount     int                         `json:"nodeCount"`
	AcceptedCount int                         `json:"acceptedCount"`
	OpenCallCount int                         `json:"openCallCount"`
	Calls         []collaborationCallResponse `json:"calls"`
}

type contributionActivityResponse struct {
	Submission collaborationSubmissionResponse `json:"submission"`
	Call       collaborationCallResponse       `json:"call"`
}

type createCollaborationCallRequest struct {
	TargetContractID string `json:"targetContractId"`
	Title            string `json:"title"`
	MaxSubmissions   int    `json:"maxSubmissions"`
}

type createCollaborationSubmissionRequest struct {
	SourceRecordID string `json:"sourceRecordId"`
	MappingText    string `json:"mappingText"`
	Note           string `json:"note"`
}

type createCollaborationReviewRequest struct {
	SubmissionIDs []string `json:"submissionIds"`
}

func (h *Handler) handleProjectCollaborationCalls(w http.ResponseWriter, r *http.Request, userID uint64, projectID string) {
	var input createCollaborationCallRequest
	if !bindJSON(w, r, &input) {
		return
	}
	call, err := h.collaboration.CreateCall(r.Context(), applicationcollaboration.CreateCallInput{
		OwnerID: userID, ProjectID: projectID, TargetContractID: input.TargetContractID,
		Title: input.Title, MaxSubmissions: input.MaxSubmissions,
	})
	if errors.Is(err, applicationcollaboration.ErrNotFound) {
		writeError(w, http.StatusNotFound, "项目或目标节点不存在")
		return
	}
	if errors.Is(err, applicationcollaboration.ErrProjectPrivate) {
		writeError(w, http.StatusBadRequest, "只有公开项目可以发布开放缺口")
		return
	}
	if errors.Is(err, applicationcollaboration.ErrTargetNotReady) {
		writeError(w, http.StatusBadRequest, "只能为等待推进的冻结节点发布开放缺口")
		return
	}
	if errors.Is(err, applicationcollaboration.ErrCallExists) {
		writeError(w, http.StatusBadRequest, "这个节点已经有一个开放缺口")
		return
	}
	if errors.Is(err, applicationcollaboration.ErrInvalidRequest) {
		writeError(w, http.StatusBadRequest, "开放缺口参数不正确")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "创建开放缺口失败")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"call": call})
}
func (h *Handler) handleExploreProjects(w http.ResponseWriter, r *http.Request) {
	projects, err := h.collaboration.ListExplore(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取公开项目失败")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"projects": projects})
}
func (h *Handler) handleExploreProject(w http.ResponseWriter, r *http.Request, projectID string) {
	project, err := h.collaboration.GetProject(r.Context(), strings.TrimSpace(projectID))
	if errors.Is(err, applicationcollaboration.ErrNotFound) {
		writeError(w, http.StatusNotFound, "公开项目不存在")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取公开项目失败")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"project": project})
}
func (h *Handler) getCollaborationCall(w http.ResponseWriter, r *http.Request, callID string) {
	details, err := h.collaboration.GetCallDetails(r.Context(), callID)
	if errors.Is(err, applicationcollaboration.ErrNotFound) {
		writeError(w, http.StatusNotFound, "开放缺口不存在")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取开放缺口失败")
		return
	}
	writeJSON(w, http.StatusOK, details)
}
func (h *Handler) createCollaborationSubmission(w http.ResponseWriter, r *http.Request, userID uint64, callID string) {
	var input createCollaborationSubmissionRequest
	if !bindJSON(w, r, &input) {
		return
	}
	details, err := h.collaboration.Submit(r.Context(), applicationcollaboration.SubmitInput{
		UserID: userID, CallID: callID, SourceRecordID: input.SourceRecordID,
		MappingText: input.MappingText, Note: input.Note,
	})
	if errors.Is(err, applicationcollaboration.ErrNotFound) {
		writeError(w, http.StatusNotFound, "开放缺口不存在")
		return
	}
	if errors.Is(err, applicationcollaboration.ErrDuplicateSubmission) {
		writeError(w, http.StatusBadRequest, "这份成果已经提交给该开放缺口")
		return
	}
	if errors.Is(err, applicationcollaboration.ErrSubmissionInvalid) {
		writeError(w, http.StatusBadRequest, "请选择自己的公开成果，并说明它对应目标标准的哪一部分")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "提交贡献失败")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"submissions": details.Submissions})
}
func (h *Handler) reviewCollaborationSubmissions(w http.ResponseWriter, r *http.Request, userID uint64, callID string) {
	var input createCollaborationReviewRequest
	if !bindJSON(w, r, &input) {
		return
	}
	input.SubmissionIDs = uniqueNonEmpty(input.SubmissionIDs)
	if len(input.SubmissionIDs) == 0 {
		writeError(w, http.StatusBadRequest, "请选择要组合审查的贡献")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), sharedconstants.ConversationReviewTimeout)
	defer cancel()
	call, err := h.collaboration.GetCall(ctx, callID)
	if errors.Is(err, applicationcollaboration.ErrNotFound) {
		writeError(w, http.StatusNotFound, "开放缺口不存在")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取开放缺口失败")
		return
	}
	if call.CreatedBy != userID {
		writeError(w, http.StatusForbidden, "只有项目维护者可以审查贡献组合")
		return
	}
	if call.Status != "open" || call.Target.Stage != "frozen" {
		writeError(w, http.StatusBadRequest, "这个开放缺口已经关闭或目标状态已变化")
		return
	}
	submissions, err := h.collaboration.ListSubmissions(ctx, callID, input.SubmissionIDs)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取待审查贡献失败")
		return
	}
	if len(submissions) != len(input.SubmissionIDs) {
		writeError(w, http.StatusBadRequest, "只能审查当前开放缺口中已提交的贡献")
		return
	}

	reviewRequest, err := h.loadCollaborationReviewRequest(ctx, call, submissions)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取目标审查规则失败")
		return
	}
	key, err := h.loadProjectAIKey(ctx, userID, call.ProjectID)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusBadRequest, "请先为项目选择审查 AI")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取项目审查 AI 失败")
		return
	}
	review, err := runAIReview(ctx, key, reviewRequest)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	review.AIConfig = key.snapshot()
	batchID, err := newOpaqueID("collaboration-review")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "创建组合审查失败")
		return
	}
	reviewJSON, err := jsonValue(review)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存组合审查失败")
		return
	}
	status := "reviewed_gap"
	if review.Verdict == "pass" {
		status = "reviewed_pass"
	}
	if err := h.collaboration.CreateReviewBatch(ctx, applicationcollaboration.CreateReviewBatchInput{
		UserID: userID, BatchID: batchID, CallID: callID, SubmissionIDs: input.SubmissionIDs,
		ReviewJSON: reviewJSON, Status: status,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, "保存组合审查失败")
		return
	}
	_ = h.aiKey.MarkUsed(ctx, userID, key.UUID)
	writeJSON(w, http.StatusOK, map[string]any{"batch": collaborationReviewBatchResponse{ID: batchID, CallID: callID, SubmissionIDs: input.SubmissionIDs, Review: review, Status: status, CreatedAt: time.Now()}})
}

func (h *Handler) loadCollaborationReviewRequest(ctx context.Context, call applicationcollaboration.Call, submissions []applicationcollaboration.Submission) (reviewExecutionNodeRequest, error) {
	var request reviewExecutionNodeRequest
	request.NodeID = call.Target.ID
	request.Title = call.Target.Title
	request.VerifiableGoal = call.Target.VerifiableGoal
	request.AcceptanceCriteria = make([]reviewCriterionRequest, 0, len(call.Target.AcceptanceCriteria))
	for _, criterion := range call.Target.AcceptanceCriteria {
		request.AcceptanceCriteria = append(request.AcceptanceCriteria, reviewCriterionRequest{ID: criterion.ID, Text: criterion.Text, RequiredEvidence: criterion.RequiredEvidence})
	}
	request.EvidenceRequirement = call.Target.EvidenceRequirement
	context, err := h.collaboration.ReviewContext(ctx, call.ProjectID, call.Target.ID)
	if err != nil {
		return request, err
	}
	request.Project.Title = context.ProjectTitle
	request.Project.Description = context.ProjectDescription
	request.Project.ProjectRules = context.ProjectRules
	request.OriginalIntent = context.OriginalIntent
	request.SmartContract.ID = context.SmartContractID
	request.SmartContract.Name = context.SmartContractName
	request.SmartContract.Description = context.SmartContractDesc
	request.SmartContract.Body = context.SmartContractBody
	request.Project.ID = call.ProjectID
	request.CompletionClaim = fmt.Sprintf("项目维护者选择了 %d 份外部已锁定成果，申请作为「%s」的组合证据。", len(submissions), call.Target.Title)
	parts := make([]string, 0, len(submissions))
	for _, submission := range submissions {
		parts = append(parts, fmt.Sprintf("来源成果：%s（%s / @%s）\n成果摘要：%s\n贡献者映射：%s\n补充说明：%s", submission.SourceTitle, submission.SourceProjectTitle, submission.ContributorUserID, submission.SourceSummary, submission.MappingText, submission.Note))
	}
	request.EvidenceText = strings.Join(parts, "\n\n---\n\n")
	return request, nil
}

func (h *Handler) adoptCollaborationReview(w http.ResponseWriter, r *http.Request, userID uint64, batchID string) {
	ctx, cancel := context.WithTimeout(r.Context(), sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	if err := h.collaboration.AdoptReview(ctx, applicationcollaboration.AdoptReviewInput{UserID: userID, BatchID: batchID}); err != nil {
		if errors.Is(err, applicationcollaboration.ErrNotFound) {
			writeError(w, http.StatusNotFound, "组合审查不存在")
			return
		}
		if errors.Is(err, applicationcollaboration.ErrUnauthorized) {
			writeError(w, http.StatusForbidden, "只有项目维护者可以采纳贡献")
			return
		}
		if errors.Is(err, applicationcollaboration.ErrInvalidRequest) {
			writeError(w, http.StatusBadRequest, "目标节点或贡献状态已经变化，不能采纳这批贡献")
			return
		}
		writeError(w, http.StatusInternalServerError, "采纳贡献失败")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "贡献已采纳。来源作者和来源成果会一直保留在协作记录中。"})
}

func (h *Handler) handleContributionSources(w http.ResponseWriter, r *http.Request) {
	user, ok := h.requireUser(w, r)
	if !ok {
		return
	}
	sources, err := h.collaboration.ListContributionSources(r.Context(), user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取可提交成果失败")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"sources": sources})
}

func (h *Handler) handleMyContributions(w http.ResponseWriter, r *http.Request) {
	user, ok := h.requireUser(w, r)
	if !ok {
		return
	}
	items, err := h.collaboration.ListContributionActivities(r.Context(), user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取协作回流失败")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"contributions": items})
}
