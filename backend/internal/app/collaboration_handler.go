package app

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

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

func (s *server) handleProjectCollaborationCalls(w http.ResponseWriter, r *http.Request, userID uint64, projectID string) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "不支持的请求方法")
		return
	}
	var input createCollaborationCallRequest
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "请求格式不正确")
		return
	}
	input.TargetContractID = strings.TrimSpace(input.TargetContractID)
	input.Title = strings.TrimSpace(input.Title)
	if input.TargetContractID == "" {
		writeError(w, http.StatusBadRequest, "请选择需要开放协作的节点")
		return
	}
	if input.MaxSubmissions <= 0 {
		input.MaxSubmissions = 10
	}
	if input.MaxSubmissions > 30 {
		writeError(w, http.StatusBadRequest, "单个开放缺口最多接收 30 份贡献")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	var targetTitle, stage, visibility string
	err := s.db.QueryRowContext(ctx, `SELECT n.title, n.stage, p.visibility FROM execution_contracts n JOIN projects p ON p.id = n.project_id WHERE n.id = ? AND n.project_id = ? AND p.owner_id = ? AND p.archived_at IS NULL`, input.TargetContractID, projectID, userID).Scan(&targetTitle, &stage, &visibility)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, "项目或目标节点不存在")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取目标节点失败")
		return
	}
	if visibility != "public" {
		writeError(w, http.StatusBadRequest, "只有公开项目可以发布开放缺口")
		return
	}
	if stage != "frozen" {
		writeError(w, http.StatusBadRequest, "只能为等待推进的冻结节点发布开放缺口")
		return
	}
	if input.Title == "" {
		input.Title = targetTitle
	}
	var exists bool
	if err := s.db.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM collaboration_calls WHERE project_id = ? AND target_contract_id = ? AND status = 'open')`, projectID, input.TargetContractID).Scan(&exists); err != nil {
		writeError(w, http.StatusInternalServerError, "读取开放缺口失败")
		return
	}
	if exists {
		writeError(w, http.StatusBadRequest, "这个节点已经有一个开放缺口")
		return
	}
	id, err := newOpaqueID("call")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "创建开放缺口失败")
		return
	}
	if _, err := s.db.ExecContext(ctx, `INSERT INTO collaboration_calls (id, project_id, target_contract_id, created_by, title, max_submissions) VALUES (?, ?, ?, ?, ?, ?)`, id, projectID, input.TargetContractID, userID, input.Title, input.MaxSubmissions); err != nil {
		writeError(w, http.StatusInternalServerError, "创建开放缺口失败")
		return
	}
	call, err := s.loadCollaborationCall(ctx, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取开放缺口失败")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"call": call})
}

func (s *server) handleExploreProjects(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "不支持的请求方法")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	rows, err := s.db.QueryContext(ctx, `
		SELECT p.id, p.title, p.description, u.username, u.user_id,
		       (SELECT COUNT(*) FROM execution_contracts n WHERE n.project_id = p.id),
		       (SELECT COUNT(*) FROM completion_records r WHERE r.project_id = p.id AND r.record_kind = 'accepted'),
		       (SELECT COUNT(*) FROM collaboration_calls c WHERE c.project_id = p.id AND c.status = 'open')
		FROM projects p JOIN users u ON u.id = p.owner_id
		WHERE p.visibility = 'public' AND p.archived_at IS NULL
		ORDER BY (SELECT COUNT(*) FROM collaboration_calls c WHERE c.project_id = p.id AND c.status = 'open') DESC, p.updated_at DESC`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取公开项目失败")
		return
	}
	defer rows.Close()
	projects := make([]exploreProjectResponse, 0)
	for rows.Next() {
		var project exploreProjectResponse
		if err := rows.Scan(&project.ID, &project.Title, &project.Description, &project.OwnerName, &project.OwnerUserID, &project.NodeCount, &project.AcceptedCount, &project.OpenCallCount); err != nil {
			writeError(w, http.StatusInternalServerError, "读取公开项目失败")
			return
		}
		calls, err := s.loadProjectCollaborationCalls(ctx, project.ID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "读取开放缺口失败")
			return
		}
		project.Calls = calls
		projects = append(projects, project)
	}
	writeJSON(w, http.StatusOK, map[string]any{"projects": projects})
}

func (s *server) handleExploreProject(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "不支持的请求方法")
		return
	}
	projectID := strings.TrimSpace(strings.TrimPrefix(r.URL.Path, "/api/explore/projects/"))
	ctx, cancel := context.WithTimeout(r.Context(), sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	var project exploreProjectResponse
	err := s.db.QueryRowContext(ctx, `
		SELECT p.id, p.title, p.description, u.username, u.user_id,
		       (SELECT COUNT(*) FROM execution_contracts n WHERE n.project_id = p.id),
		       (SELECT COUNT(*) FROM completion_records r WHERE r.project_id = p.id AND r.record_kind = 'accepted'),
		       (SELECT COUNT(*) FROM collaboration_calls c WHERE c.project_id = p.id AND c.status = 'open')
		FROM projects p JOIN users u ON u.id = p.owner_id WHERE p.id = ? AND p.visibility = 'public' AND p.archived_at IS NULL`, projectID).
		Scan(&project.ID, &project.Title, &project.Description, &project.OwnerName, &project.OwnerUserID, &project.NodeCount, &project.AcceptedCount, &project.OpenCallCount)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, "公开项目不存在")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取公开项目失败")
		return
	}
	calls, err := s.loadProjectCollaborationCalls(ctx, project.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取开放缺口失败")
		return
	}
	project.Calls = calls
	writeJSON(w, http.StatusOK, map[string]any{"project": project})
}

func (s *server) loadProjectCollaborationCalls(ctx context.Context, projectID string) ([]collaborationCallResponse, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id FROM collaboration_calls WHERE project_id = ? ORDER BY status = 'open' DESC, created_at DESC`, projectID)
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
		call, err := s.loadCollaborationCall(ctx, id)
		if err != nil {
			return nil, err
		}
		calls = append(calls, call)
	}
	return calls, rows.Err()
}

func (s *server) loadCollaborationCall(ctx context.Context, id string) (collaborationCallResponse, error) {
	var call collaborationCallResponse
	var criteriaJSON string
	err := s.db.QueryRowContext(ctx, `
		SELECT c.id, c.project_id, p.title, u.username, u.user_id, c.created_by, c.title, c.status, c.max_submissions, c.created_at,
		       n.id, n.title, n.verifiable_goal, n.acceptance_criteria_json, n.evidence_requirement, n.stage,
		       (SELECT COUNT(*) FROM collaboration_submissions s WHERE s.call_id = c.id AND s.status <> 'withdrawn')
		FROM collaboration_calls c
		JOIN projects p ON p.id = c.project_id
		JOIN users u ON u.id = p.owner_id
		JOIN execution_contracts n ON n.id = c.target_contract_id
		WHERE c.id = ?`, id).
		Scan(&call.ID, &call.ProjectID, &call.ProjectTitle, &call.OwnerName, &call.OwnerUserID, &call.CreatedBy, &call.Title, &call.Status, &call.MaxSubmissions, &call.CreatedAt,
			&call.Target.ID, &call.Target.Title, &call.Target.VerifiableGoal, &criteriaJSON, &call.Target.EvidenceRequirement, &call.Target.Stage, &call.SubmissionCount)
	if err != nil {
		return call, err
	}
	_ = json.Unmarshal([]byte(criteriaJSON), &call.Target.AcceptanceCriteria)
	return call, nil
}

func (s *server) handleCollaborationCall(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requireUser(w, r)
	if !ok {
		return
	}
	parts := strings.Split(strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/collaboration-calls"), "/"), "/")
	if len(parts) == 0 || parts[0] == "" {
		writeError(w, http.StatusNotFound, "开放缺口不存在")
		return
	}
	callID := parts[0]
	switch {
	case len(parts) == 1 && r.Method == http.MethodGet:
		s.getCollaborationCall(w, r, callID)
	case len(parts) == 2 && parts[1] == "submissions" && r.Method == http.MethodPost:
		s.createCollaborationSubmission(w, r, user.ID, callID)
	case len(parts) == 2 && parts[1] == "reviews" && r.Method == http.MethodPost:
		s.reviewCollaborationSubmissions(w, r, user.ID, callID)
	default:
		writeError(w, http.StatusNotFound, "协作接口不存在")
	}
}

func (s *server) getCollaborationCall(w http.ResponseWriter, r *http.Request, callID string) {
	ctx, cancel := context.WithTimeout(r.Context(), sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	call, err := s.loadCollaborationCall(ctx, callID)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, "开放缺口不存在")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取开放缺口失败")
		return
	}
	submissions, err := s.loadCollaborationSubmissions(ctx, callID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取贡献失败")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"call": call, "submissions": submissions})
}

func (s *server) loadCollaborationSubmissions(ctx context.Context, callID string) ([]collaborationSubmissionResponse, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT s.id, s.call_id, s.source_record_id, r.title, r.summary, source_project.title,
		       s.contributor_id, u.username, u.user_id, s.mapping_text, COALESCE(s.note, ''), s.status, s.created_at
		FROM collaboration_submissions s
		JOIN completion_records r ON r.id = s.source_record_id
		JOIN projects source_project ON source_project.id = r.project_id
		JOIN users u ON u.id = s.contributor_id
		WHERE s.call_id = ? ORDER BY s.created_at DESC`, callID)
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

func (s *server) createCollaborationSubmission(w http.ResponseWriter, r *http.Request, userID uint64, callID string) {
	var input createCollaborationSubmissionRequest
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "请求格式不正确")
		return
	}
	input.SourceRecordID = strings.TrimSpace(input.SourceRecordID)
	input.MappingText = strings.TrimSpace(input.MappingText)
	input.Note = strings.TrimSpace(input.Note)
	if input.SourceRecordID == "" || len([]rune(input.MappingText)) < 8 {
		writeError(w, http.StatusBadRequest, "请选择自己的公开成果，并说明它对应目标标准的哪一部分")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	call, err := s.loadCollaborationCall(ctx, callID)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, "开放缺口不存在")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取开放缺口失败")
		return
	}
	if call.Status != "open" || call.Target.Stage != "frozen" {
		writeError(w, http.StatusBadRequest, "这个开放缺口已经关闭")
		return
	}
	if call.SubmissionCount >= call.MaxSubmissions {
		writeError(w, http.StatusBadRequest, "这个开放缺口的贡献名额已满")
		return
	}
	var sourceOwner uint64
	err = s.db.QueryRowContext(ctx, `
		SELECT n.actor_id FROM completion_records r
		JOIN projects p ON p.id = r.project_id
		JOIN execution_contracts n ON n.id = r.closing_contract_id
		WHERE r.id = ? AND r.record_kind = 'accepted' AND p.visibility = 'public'`, input.SourceRecordID).Scan(&sourceOwner)
	if errors.Is(err, sql.ErrNoRows) || sourceOwner != userID {
		writeError(w, http.StatusBadRequest, "只能提交自己已锁定的公开成果")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取来源成果失败")
		return
	}
	id, err := newOpaqueID("contribution")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "提交贡献失败")
		return
	}
	_, err = s.db.ExecContext(ctx, `INSERT INTO collaboration_submissions (id, call_id, source_record_id, contributor_id, mapping_text, note) VALUES (?, ?, ?, ?, ?, ?)`, id, callID, input.SourceRecordID, userID, input.MappingText, input.Note)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "duplicate") {
			writeError(w, http.StatusBadRequest, "这份成果已经提交给该开放缺口")
			return
		}
		writeError(w, http.StatusInternalServerError, "提交贡献失败")
		return
	}
	items, err := s.loadCollaborationSubmissions(ctx, callID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取贡献失败")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"submissions": items})
}

func (s *server) reviewCollaborationSubmissions(w http.ResponseWriter, r *http.Request, userID uint64, callID string) {
	var input createCollaborationReviewRequest
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "请求格式不正确")
		return
	}
	input.SubmissionIDs = uniqueNonEmpty(input.SubmissionIDs)
	if len(input.SubmissionIDs) == 0 {
		writeError(w, http.StatusBadRequest, "请选择要组合审查的贡献")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 85*time.Second)
	defer cancel()
	call, err := s.loadCollaborationCall(ctx, callID)
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
	submissions, err := s.loadSelectedCollaborationSubmissions(ctx, callID, input.SubmissionIDs)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取待审查贡献失败")
		return
	}
	if len(submissions) != len(input.SubmissionIDs) {
		writeError(w, http.StatusBadRequest, "只能审查当前开放缺口中已提交的贡献")
		return
	}

	reviewRequest, err := s.loadCollaborationReviewRequest(ctx, call, submissions)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取目标审查规则失败")
		return
	}
	key, err := s.loadProjectAIKey(ctx, userID, call.ProjectID)
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
	idsJSON, _ := jsonValue(input.SubmissionIDs)
	reviewJSON, _ := jsonValue(review)
	status := "reviewed_gap"
	if review.Verdict == "pass" {
		status = "reviewed_pass"
	}
	if _, err := s.db.ExecContext(ctx, `INSERT INTO collaboration_review_batches (id, call_id, project_id, target_contract_id, created_by, submission_ids_json, ai_review_json, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, batchID, callID, call.ProjectID, call.Target.ID, userID, idsJSON, reviewJSON, status); err != nil {
		writeError(w, http.StatusInternalServerError, "保存组合审查失败")
		return
	}
	_, _ = s.db.ExecContext(ctx, `UPDATE ai_api_keys SET last_used_at = NOW() WHERE id = ? AND user_id = ?`, key.ID, userID)
	writeJSON(w, http.StatusOK, map[string]any{"batch": collaborationReviewBatchResponse{ID: batchID, CallID: callID, SubmissionIDs: input.SubmissionIDs, Review: review, Status: status, CreatedAt: time.Now()}})
}

func (s *server) loadSelectedCollaborationSubmissions(ctx context.Context, callID string, ids []string) ([]collaborationSubmissionResponse, error) {
	placeholders := strings.TrimRight(strings.Repeat("?,", len(ids)), ",")
	args := make([]any, 0, len(ids)+1)
	args = append(args, callID)
	for _, id := range ids {
		args = append(args, id)
	}
	query := fmt.Sprintf(`
		SELECT s.id, s.call_id, s.source_record_id, r.title, r.summary, source_project.title,
		       s.contributor_id, u.username, u.user_id, s.mapping_text, COALESCE(s.note, ''), s.status, s.created_at
		FROM collaboration_submissions s
		JOIN completion_records r ON r.id = s.source_record_id
		JOIN projects source_project ON source_project.id = r.project_id
		JOIN users u ON u.id = s.contributor_id
		WHERE s.call_id = ? AND s.status = 'submitted' AND s.id IN (%s)`, placeholders)
	rows, err := s.db.QueryContext(ctx, query, args...)
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

func (s *server) loadCollaborationReviewRequest(ctx context.Context, call collaborationCallResponse, submissions []collaborationSubmissionResponse) (reviewExecutionNodeRequest, error) {
	var request reviewExecutionNodeRequest
	request.NodeID = call.Target.ID
	request.Title = call.Target.Title
	request.VerifiableGoal = call.Target.VerifiableGoal
	request.AcceptanceCriteria = call.Target.AcceptanceCriteria
	request.EvidenceRequirement = call.Target.EvidenceRequirement
	var smartContractBody string
	err := s.db.QueryRowContext(ctx, `
		SELECT p.title, p.description, COALESCE(p.project_rules, ''), n.original_intent, n.smart_contract_id,
		       COALESCE(sc.name, ''), COALESCE(sc.description, ''), COALESCE(sc.body, '')
		FROM projects p JOIN execution_contracts n ON n.id = ? AND n.project_id = p.id
		LEFT JOIN smart_contracts sc ON sc.id = n.smart_contract_id
		WHERE p.id = ?`, call.Target.ID, call.ProjectID).
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

func (s *server) handleCollaborationReview(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requireUser(w, r)
	if !ok {
		return
	}
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "不支持的请求方法")
		return
	}
	batchID := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/collaboration-calls/reviews/"), "/")
	if !strings.HasSuffix(batchID, "/adopt") {
		writeError(w, http.StatusNotFound, "协作审查不存在")
		return
	}
	batchID = strings.TrimSuffix(batchID, "/adopt")
	s.adoptCollaborationReview(w, r, user.ID, batchID)
}

func (s *server) adoptCollaborationReview(w http.ResponseWriter, r *http.Request, userID uint64, batchID string) {
	ctx, cancel := context.WithTimeout(r.Context(), sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "采纳贡献失败")
		return
	}
	defer tx.Rollback()
	var callID, projectID, targetID, status, callStatus, idsJSON, reviewJSON string
	var ownerID uint64
	err = tx.QueryRowContext(ctx, `SELECT b.call_id, b.project_id, b.target_contract_id, b.status, c.status, b.submission_ids_json, b.ai_review_json, p.owner_id FROM collaboration_review_batches b JOIN projects p ON p.id = b.project_id JOIN collaboration_calls c ON c.id = b.call_id WHERE b.id = ? FOR UPDATE`, batchID).Scan(&callID, &projectID, &targetID, &status, &callStatus, &idsJSON, &reviewJSON, &ownerID)
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
	if err := tx.QueryRowContext(ctx, `SELECT stage FROM execution_contracts WHERE id = ? AND project_id = ? FOR UPDATE`, targetID, projectID).Scan(&targetStage); err != nil || targetStage != "frozen" {
		writeError(w, http.StatusBadRequest, "目标节点已经变化，不能采纳这批贡献")
		return
	}
	var ids []string
	if err := json.Unmarshal([]byte(idsJSON), &ids); err != nil || len(ids) == 0 {
		writeError(w, http.StatusInternalServerError, "组合审查范围损坏")
		return
	}
	placeholders := strings.TrimRight(strings.Repeat("?,", len(ids)), ",")
	args := make([]any, 0, len(ids)+1)
	args = append(args, callID)
	for _, id := range ids {
		args = append(args, id)
	}
	result, err := tx.ExecContext(ctx, fmt.Sprintf(`UPDATE collaboration_submissions SET status = 'adopted' WHERE call_id = ? AND status = 'submitted' AND id IN (%s)`, placeholders), args...)
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
	evidence := "已采纳协作来源：" + strings.Join(ids, "、")
	if _, err := tx.ExecContext(ctx, `UPDATE execution_contracts SET stage = 'verified', completion_claim = ?, evidence_text = ?, ai_review_json = ? WHERE id = ? AND project_id = ? AND stage = 'frozen'`, claim, evidence, reviewJSON, targetID, projectID); err != nil {
		writeError(w, http.StatusInternalServerError, "写入目标节点审查结果失败")
		return
	}
	if _, err := tx.ExecContext(ctx, `UPDATE collaboration_review_batches SET status = 'adopted', adopted_at = NOW() WHERE id = ?`, batchID); err != nil {
		writeError(w, http.StatusInternalServerError, "保存采纳记录失败")
		return
	}
	if _, err := tx.ExecContext(ctx, `UPDATE collaboration_calls SET status = 'adopted' WHERE id = ?`, callID); err != nil {
		writeError(w, http.StatusInternalServerError, "关闭开放缺口失败")
		return
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "采纳贡献失败")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "贡献已采纳。来源作者和来源成果会一直保留在协作记录中。"})
}

func (s *server) handleContributionSources(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requireUser(w, r)
	if !ok {
		return
	}
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "不支持的请求方法")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	rows, err := s.db.QueryContext(ctx, `
		SELECT r.id, r.title, r.summary, p.title
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

func (s *server) handleMyContributions(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requireUser(w, r)
	if !ok {
		return
	}
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "不支持的请求方法")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	rows, err := s.db.QueryContext(ctx, `SELECT id, call_id FROM collaboration_submissions WHERE contributor_id = ? AND status <> 'withdrawn' ORDER BY updated_at DESC`, user.ID)
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
		call, err := s.loadCollaborationCall(ctx, callID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "读取协作回流失败")
			return
		}
		submissions, err := s.loadCollaborationSubmissions(ctx, callID)
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
