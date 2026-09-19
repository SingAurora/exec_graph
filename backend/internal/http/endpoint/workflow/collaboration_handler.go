package workflow

import (
	"context"
	"database/sql"
	"encoding/json"
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
func (h *Handler) loadProjectCollaborationCalls(ctx context.Context, projectID string) ([]collaborationCallResponse, error) {
	rows, err := h.collaborationStore.Rows(ctx, `SELECT c.uuid FROM collaboration_calls c JOIN projects p ON p.id = c.project_id WHERE p.uuid = ? ORDER BY c.status = 'open' DESC, c.created_at DESC`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	calls := make([]collaborationCallResponse, 0)
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		call, err := h.loadCollaborationCall(ctx, id)
		if err != nil {
			return nil, err
		}
		calls = append(calls, call)
	}
	return calls, rows.Err()
}

func (h *Handler) loadCollaborationCall(ctx context.Context, id string) (collaborationCallResponse, error) {
	var call collaborationCallResponse
	var criteriaJSON string
	err := h.collaborationStore.Row(ctx, `
		SELECT c.uuid, p.uuid, p.title, u.username, u.user_id, c.created_by, c.title, c.status, c.max_submissions, c.created_at,
		       n.uuid, n.title, n.verifiable_goal, n.acceptance_criteria_json, n.evidence_requirement, n.stage,
		       (SELECT COUNT(*) FROM collaboration_submissions s WHERE h.call_id = c.id AND h.status <> 'withdrawn')
		FROM collaboration_calls c
		JOIN projects p ON p.id = c.project_id
		JOIN users u ON u.id = p.owner_id
		JOIN execution_contracts n ON n.id = c.target_contract_id
		WHERE c.uuid = ?`, id).
		Scan(&call.ID, &call.ProjectID, &call.ProjectTitle, &call.OwnerName, &call.OwnerUserID, &call.CreatedBy, &call.Title, &call.Status, &call.MaxSubmissions, &call.CreatedAt,
			&call.Target.ID, &call.Target.Title, &call.Target.VerifiableGoal, &criteriaJSON, &call.Target.EvidenceRequirement, &call.Target.Stage, &call.SubmissionCount)
	if err != nil {
		return call, err
	}
	_ = json.Unmarshal([]byte(criteriaJSON), &call.Target.AcceptanceCriteria)
	return call, nil
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
func (h *Handler) loadCollaborationSubmissions(ctx context.Context, callID string) ([]collaborationSubmissionResponse, error) {
	rows, err := h.collaborationStore.Rows(ctx, `
		SELECT h.uuid, c.uuid, r.uuid, r.title, r.summary, source_project.title,
		       h.contributor_id, u.username, u.user_id, h.mapping_text, COALESCE(h.note, ''), h.status, h.created_at
		FROM collaboration_submissions s
		JOIN completion_records r ON r.id = h.source_record_id
		JOIN projects source_project ON source_project.id = r.project_id
		JOIN collaboration_calls c ON c.id = h.call_id
		JOIN users u ON u.id = h.contributor_id
		WHERE c.uuid = ? ORDER BY h.created_at DESC`, callID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]collaborationSubmissionResponse, 0)
	for rows.Next() {
		var item collaborationSubmissionResponse
		if err := rows.Scan(&item.ID, &item.CallID, &item.SourceRecordID, &item.SourceTitle, &item.SourceSummary, &item.SourceProjectTitle, &item.ContributorID, &item.ContributorName, &item.ContributorUserID, &item.MappingText, &item.Note, &item.Status, &item.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
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
	call, err := h.loadCollaborationCall(ctx, callID)
	if errors.Is(err, sql.ErrNoRows) {
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
	submissions, err := h.loadSelectedCollaborationSubmissions(ctx, callID, input.SubmissionIDs)
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
	internalSubmissionIDs := make([]uint64, 0, len(input.SubmissionIDs))
	for _, submissionID := range input.SubmissionIDs {
		submissionInternalID, err := internalID(ctx, h.collaborationStore, "collaboration_submissions", submissionID)
		if err != nil {
			writeError(w, http.StatusBadRequest, "待审查贡献不存在")
			return
		}
		internalSubmissionIDs = append(internalSubmissionIDs, submissionInternalID)
	}
	idsJSON, _ := jsonValue(internalSubmissionIDs)
	reviewJSON, _ := jsonValue(review)
	status := "reviewed_gap"
	if review.Verdict == "pass" {
		status = "reviewed_pass"
	}
	callInternalID, err := internalID(ctx, h.collaborationStore, "collaboration_calls", callID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取开放缺口失败")
		return
	}
	projectInternalID, err := internalID(ctx, h.collaborationStore, "projects", call.ProjectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取项目失败")
		return
	}
	targetInternalID, err := internalID(ctx, h.collaborationStore, "execution_contracts", call.Target.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取目标节点失败")
		return
	}
	if _, err := h.collaborationStore.Execute(ctx, `INSERT INTO collaboration_review_batches (uuid, call_id, project_id, target_contract_id, created_by, submission_ids_json, ai_review_json, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, batchID, callInternalID, projectInternalID, targetInternalID, userID, idsJSON, reviewJSON, status); err != nil {
		writeError(w, http.StatusInternalServerError, "保存组合审查失败")
		return
	}
	_, _ = h.collaborationStore.Execute(ctx, `UPDATE ai_api_keys SET last_used_at = NOW() WHERE uuid = ? AND user_id = ?`, key.UUID, userID)
	writeJSON(w, http.StatusOK, map[string]any{"batch": collaborationReviewBatchResponse{ID: batchID, CallID: callID, SubmissionIDs: input.SubmissionIDs, Review: review, Status: status, CreatedAt: time.Now()}})
}

func (h *Handler) loadSelectedCollaborationSubmissions(ctx context.Context, callID string, ids []string) ([]collaborationSubmissionResponse, error) {
	placeholders := strings.TrimRight(strings.Repeat("?,", len(ids)), ",")
	args := make([]any, 0, len(ids)+1)
	args = append(args, callID)
	for _, id := range ids {
		args = append(args, id)
	}
	query := fmt.Sprintf(`
		SELECT h.uuid, c.uuid, r.uuid, r.title, r.summary, source_project.title,
		       h.contributor_id, u.username, u.user_id, h.mapping_text, COALESCE(h.note, ''), h.status, h.created_at
		FROM collaboration_submissions s
		JOIN completion_records r ON r.id = h.source_record_id
		JOIN projects source_project ON source_project.id = r.project_id
		JOIN collaboration_calls c ON c.id = h.call_id
		JOIN users u ON u.id = h.contributor_id
		WHERE c.uuid = ? AND h.status = 'submitted' AND h.uuid IN (%s)`, placeholders)
	rows, err := h.collaborationStore.Rows(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]collaborationSubmissionResponse, 0, len(ids))
	for rows.Next() {
		var item collaborationSubmissionResponse
		if err := rows.Scan(&item.ID, &item.CallID, &item.SourceRecordID, &item.SourceTitle, &item.SourceSummary, &item.SourceProjectTitle, &item.ContributorID, &item.ContributorName, &item.ContributorUserID, &item.MappingText, &item.Note, &item.Status, &item.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (h *Handler) loadCollaborationReviewRequest(ctx context.Context, call collaborationCallResponse, submissions []collaborationSubmissionResponse) (reviewExecutionNodeRequest, error) {
	var request reviewExecutionNodeRequest
	request.NodeID = call.Target.ID
	request.Title = call.Target.Title
	request.VerifiableGoal = call.Target.VerifiableGoal
	request.AcceptanceCriteria = call.Target.AcceptanceCriteria
	request.EvidenceRequirement = call.Target.EvidenceRequirement
	var smartContractBody string
	err := h.collaborationStore.Row(ctx, `
		SELECT p.title, p.description, COALESCE(p.project_rules, ''), n.original_intent, n.smart_contract_id,
		       COALESCE(sc.name, ''), COALESCE(sc.description, ''), COALESCE(sc.body, '')
		FROM projects p JOIN execution_contracts n ON n.uuid = ? AND n.project_id = p.id
		LEFT JOIN smart_contracts sc ON sc.id = n.smart_contract_id
		WHERE p.uuid = ?`, call.Target.ID, call.ProjectID).
		Scan(&request.Project.Title, &request.Project.Description, &request.Project.ProjectRules, &request.OriginalIntent, &request.SmartContract.ID, &request.SmartContract.Name, &request.SmartContract.Description, &smartContractBody)
	if err != nil {
		return request, err
	}
	request.Project.ID = call.ProjectID
	request.SmartContract.Body = smartContractBody
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
	tx, err := h.collaborationStore.Begin(ctx)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "采纳贡献失败")
		return
	}
	defer tx.Rollback()
	var callID, projectID, targetID, status, callStatus, idsJSON, reviewJSON string
	var ownerID uint64
	err = tx.Row(ctx, `SELECT c.uuid, p.uuid, target.uuid, b.status, c.status, b.submission_ids_json, b.ai_review_json, p.owner_id FROM collaboration_review_batches b JOIN projects p ON p.id = b.project_id JOIN collaboration_calls c ON c.id = b.call_id JOIN execution_contracts target ON target.id = b.target_contract_id WHERE b.uuid = ? FOR UPDATE`, batchID).Scan(&callID, &projectID, &targetID, &status, &callStatus, &idsJSON, &reviewJSON, &ownerID)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, "组合审查不存在")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取组合审查失败")
		return
	}
	if ownerID != userID {
		writeError(w, http.StatusForbidden, "只有项目维护者可以采纳贡献")
		return
	}
	if status != "reviewed_pass" || callStatus != "open" {
		writeError(w, http.StatusBadRequest, "只有 AI 通过的贡献组合可以采纳")
		return
	}
	var targetStage string
	if err := tx.Row(ctx, `SELECT n.stage FROM execution_contracts n JOIN projects p ON p.id = n.project_id WHERE n.uuid = ? AND p.uuid = ? FOR UPDATE`, targetID, projectID).Scan(&targetStage); err != nil || targetStage != "frozen" {
		writeError(w, http.StatusBadRequest, "目标节点已经变化，不能采纳这批贡献")
		return
	}
	var ids []uint64
	if err := json.Unmarshal([]byte(idsJSON), &ids); err != nil || len(ids) == 0 {
		writeError(w, http.StatusInternalServerError, "组合审查范围损坏")
		return
	}
	placeholders := strings.TrimRight(strings.Repeat("?,", len(ids)), ",")
	callInternalID, err := internalID(ctx, tx, "collaboration_calls", callID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取开放缺口失败")
		return
	}
	args := make([]any, 0, len(ids)+1)
	args = append(args, callInternalID)
	for _, id := range ids {
		args = append(args, id)
	}
	result, err := tx.Execute(ctx, fmt.Sprintf(`UPDATE collaboration_submissions SET status = 'adopted' WHERE call_id = ? AND status = 'submitted' AND id IN (%s)`, placeholders), args...)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "采纳贡献失败")
		return
	}
	updated, _ := result.RowsAffected()
	if updated != int64(len(ids)) {
		writeError(w, http.StatusBadRequest, "部分贡献状态已经变化，请重新审查")
		return
	}
	claim := fmt.Sprintf("项目维护者确认采纳 %d 份外部已锁定成果，作为当前节点的组合证据。", len(ids))
	publicSubmissionIDs := make([]string, 0, len(ids))
	for _, submissionID := range ids {
		publicID, err := publicUUID(ctx, tx, "collaboration_submissions", submissionID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "读取贡献失败")
			return
		}
		publicSubmissionIDs = append(publicSubmissionIDs, publicID)
	}
	evidence := "已采纳协作来源：" + strings.Join(publicSubmissionIDs, "、")
	if _, err := tx.Execute(ctx, `UPDATE execution_contracts n JOIN projects p ON p.id = n.project_id SET n.stage = 'verified', n.completion_claim = ?, n.evidence_text = ?, n.ai_review_json = ? WHERE n.uuid = ? AND p.uuid = ? AND n.stage = 'frozen'`, claim, evidence, reviewJSON, targetID, projectID); err != nil {
		writeError(w, http.StatusInternalServerError, "写入目标节点审查结果失败")
		return
	}
	if _, err := tx.Execute(ctx, `UPDATE collaboration_review_batches SET status = 'adopted', adopted_at = NOW() WHERE uuid = ?`, batchID); err != nil {
		writeError(w, http.StatusInternalServerError, "保存采纳记录失败")
		return
	}
	if _, err := tx.Execute(ctx, `UPDATE collaboration_calls SET status = 'adopted' WHERE uuid = ?`, callID); err != nil {
		writeError(w, http.StatusInternalServerError, "关闭开放缺口失败")
		return
	}
	if err := tx.Commit(); err != nil {
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
	ctx, cancel := context.WithTimeout(r.Context(), sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	rows, err := h.collaborationStore.Rows(ctx, `
		SELECT r.uuid, r.title, r.summary, p.title
		FROM completion_records r
		JOIN projects p ON p.id = r.project_id
		JOIN execution_contracts n ON n.id = r.closing_contract_id
		WHERE r.record_kind = 'accepted' AND p.visibility = 'public' AND n.actor_id = ?
		ORDER BY r.created_at DESC`, user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取可提交成果失败")
		return
	}
	defer rows.Close()
	type source struct {
		ID           string `json:"id"`
		Title        string `json:"title"`
		Summary      string `json:"summary"`
		ProjectTitle string `json:"projectTitle"`
	}
	sources := make([]source, 0)
	for rows.Next() {
		var item source
		if err := rows.Scan(&item.ID, &item.Title, &item.Summary, &item.ProjectTitle); err != nil {
			writeError(w, http.StatusInternalServerError, "读取可提交成果失败")
			return
		}
		sources = append(sources, item)
	}
	writeJSON(w, http.StatusOK, map[string]any{"sources": sources})
}

func (h *Handler) handleMyContributions(w http.ResponseWriter, r *http.Request) {
	user, ok := h.requireUser(w, r)
	if !ok {
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	rows, err := h.collaborationStore.Rows(ctx, `SELECT h.uuid, c.uuid FROM collaboration_submissions s JOIN collaboration_calls c ON c.id = h.call_id WHERE h.contributor_id = ? AND h.status <> 'withdrawn' ORDER BY h.updated_at DESC`, user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取协作回流失败")
		return
	}
	defer rows.Close()
	items := make([]contributionActivityResponse, 0)
	for rows.Next() {
		var submissionID, callID string
		if err := rows.Scan(&submissionID, &callID); err != nil {
			writeError(w, http.StatusInternalServerError, "读取协作回流失败")
			return
		}
		call, err := h.loadCollaborationCall(ctx, callID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "读取协作回流失败")
			return
		}
		submissions, err := h.loadCollaborationSubmissions(ctx, callID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "读取协作回流失败")
			return
		}
		for _, submission := range submissions {
			if submission.ID == submissionID {
				items = append(items, contributionActivityResponse{Submission: submission, Call: call})
				break
			}
		}
	}
	if err := rows.Err(); err != nil {
		writeError(w, http.StatusInternalServerError, "读取协作回流失败")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"contributions": items})
}
