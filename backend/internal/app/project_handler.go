package app

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type createProjectRequest struct {
	Title        string `json:"title"`
	Description  string `json:"description"`
	ProjectType  string `json:"projectType"`
	ProjectRules string `json:"projectRules"`
	Visibility   string `json:"visibility"`
	AIKeyID      string `json:"aiKeyId"`
}

type updateProjectRequest struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Visibility  string `json:"visibility"`
}

type projectRevisionResponse struct {
	ID                   string                 `json:"id"`
	SmartContractID      string                 `json:"smartContractId"`
	SmartContractVersion string                 `json:"smartContractVersion"`
	RuleHash             string                 `json:"ruleHash"`
	Reason               string                 `json:"reason"`
	ActivatedAt          time.Time              `json:"activatedAt"`
	SmartContract        *smartContractResponse `json:"smartContract,omitempty"`
}

type projectResponse struct {
	ID                       string                    `json:"id"`
	Title                    string                    `json:"title"`
	Description              string                    `json:"description"`
	ProjectRules             string                    `json:"projectRules"`
	IsDefault                bool                      `json:"isDefault"`
	Visibility               string                    `json:"visibility"`
	ProjectType              string                    `json:"projectType"`
	ReviewAIKeyID            *string                   `json:"reviewAIKeyId,omitempty"`
	CurrentContractID        *string                   `json:"currentContractId"`
	ActiveContractRevisionID string                    `json:"activeContractRevisionId"`
	ContractRevisions        []projectRevisionResponse `json:"contractRevisions"`
	CreatedAt                time.Time                 `json:"createdAt"`
	ArchivedAt               *time.Time                `json:"archivedAt,omitempty"`
}

type smartContractResponse struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Source      string    `json:"source"`
	Version     string    `json:"version"`
	Description string    `json:"description"`
	Body        string    `json:"body"`
	CreatedAt   time.Time `json:"createdAt"`
}

type smartContractEventResponse struct {
	ID            string                `json:"id"`
	ContractID    string                `json:"contractId"`
	EventType     string                `json:"eventType"`
	SmartContract smartContractResponse `json:"smartContract"`
	CreatedAt     time.Time             `json:"createdAt"`
}

type executionNodeResponse struct {
	ID                        string    `json:"id"`
	ProjectID                 string    `json:"projectId"`
	BranchID                  *string   `json:"branchId,omitempty"`
	ProjectContractRevisionID string    `json:"projectContractRevisionId"`
	ParentContractID          *string   `json:"parentContractId,omitempty"`
	SourceContractIDs         any       `json:"sourceContractIds,omitempty"`
	SupplementOfContractID    *string   `json:"supplementOfContractId,omitempty"`
	ActorID                   *uint64   `json:"actorId,omitempty"`
	Title                     string    `json:"title"`
	Stage                     string    `json:"stage"`
	OriginalIntent            string    `json:"originalIntent"`
	SmartContractID           string    `json:"smartContractId"`
	SmartContractVersion      string    `json:"smartContractVersion"`
	RuleHash                  string    `json:"ruleHash"`
	VerifiableGoal            string    `json:"verifiableGoal"`
	AcceptanceCriteria        any       `json:"acceptanceCriteria"`
	EvidenceRequirement       string    `json:"evidenceRequirement"`
	CompletionClaim           *string   `json:"completionClaim,omitempty"`
	EvidenceText              *string   `json:"evidenceText,omitempty"`
	CompletionRecordID        *string   `json:"completionRecordId,omitempty"`
	DraftReview               any       `json:"draftReview,omitempty"`
	DraftReviewAIConfig       any       `json:"draftReviewAIConfig,omitempty"`
	ReviewMessages            any       `json:"reviewMessages"`
	AIReview                  any       `json:"aiReview,omitempty"`
	CompletionReviewAIConfig  any       `json:"completionReviewAIConfig,omitempty"`
	CompletionReviewRounds    any       `json:"completionReviewRounds,omitempty"`
	PlanningConversationID    *string   `json:"planningConversationId,omitempty"`
	CompletionConversationID  *string   `json:"completionConversationId,omitempty"`
	UserVerdict               any       `json:"userVerdict,omitempty"`
	NextContractTitle         *string   `json:"nextContractTitle,omitempty"`
	CreatedAt                 time.Time `json:"createdAt"`
	UpdatedAt                 time.Time `json:"updatedAt"`
}

type executionEdgeResponse struct {
	ID               string    `json:"id"`
	SourceContractID string    `json:"sourceContractId"`
	TargetContractID string    `json:"targetContractId"`
	Type             string    `json:"type"`
	CreatedAt        time.Time `json:"createdAt"`
}

type executionBranchResponse struct {
	ID                   string    `json:"id"`
	ProjectID            string    `json:"projectId"`
	Title                string    `json:"title"`
	RootContractID       *string   `json:"rootContractId,omitempty"`
	ForkedFromContractID *string   `json:"forkedFromContractId,omitempty"`
	HeadContractID       *string   `json:"headContractId,omitempty"`
	CurrentContractID    *string   `json:"currentContractId,omitempty"`
	CreatedByID          uint64    `json:"createdById"`
	CreatedAt            time.Time `json:"createdAt"`
}

type completionRecordResponse struct {
	ID                   string    `json:"id"`
	ProjectID            string    `json:"projectId"`
	ClosingContractID    string    `json:"closingContractId"`
	CoveredContractIDs   []string  `json:"coveredContractIds"`
	Title                string    `json:"title"`
	Summary              string    `json:"summary"`
	SmartContractID      string    `json:"smartContractId"`
	SmartContractVersion string    `json:"smartContractVersion"`
	RuleHash             string    `json:"ruleHash"`
	ReviewID             string    `json:"reviewId"`
	AIReviewVerdict      string    `json:"aiReviewVerdict"`
	RecordKind           string    `json:"recordKind"`
	UserVerdict          any       `json:"userVerdict"`
	CreatedAt            time.Time `json:"createdAt"`
}

type createExecutionNodeRequest struct {
	Draft                  string                   `json:"draft"`
	DraftReview            nodeDraftReviewResponse  `json:"draftReview"`
	Title                  string                   `json:"title"`
	VerifiableGoal         string                   `json:"verifiableGoal"`
	AcceptanceCriteria     []reviewCriterionRequest `json:"acceptanceCriteria"`
	EvidenceRequirement    string                   `json:"evidenceRequirement"`
	ParentContractID       string                   `json:"parentContractId"`
	SourceContractIDs      []string                 `json:"sourceContractIds"`
	BranchID               string                   `json:"branchId"`
	Fork                   bool                     `json:"fork"`
	SupplementOfNodeID     string                   `json:"supplementOfContractId"`
	Closure                bool                     `json:"closure"`
	PlanningConversationID string                   `json:"planningConversationId"`
}

type setProjectAIKeyRequest struct {
	AIKeyID string `json:"aiKeyId"`
}

func (s *server) handleProjects(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requireUser(w, r)
	if !ok {
		return
	}
	remainder := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/projects"), "/")
	if remainder == "" {
		switch r.Method {
		case http.MethodGet:
			s.listProjects(w, r, user.ID)
		case http.MethodPost:
			s.createProject(w, r, user.ID)
		default:
			writeError(w, http.StatusMethodNotAllowed, "不支持的请求方法")
		}
		return
	}
	parts := strings.Split(remainder, "/")
	projectID := parts[0]
	if len(parts) == 1 {
		switch r.Method {
		case http.MethodGet:
			s.getProject(w, r, user.ID, projectID)
		case http.MethodPatch:
			s.updateProject(w, r, user.ID, projectID)
		case http.MethodDelete:
			s.deleteProject(w, r, user.ID, projectID)
		default:
			writeError(w, http.StatusMethodNotAllowed, "不支持的请求方法")
		}
		return
	}
	if len(parts) == 2 && parts[1] == "graph" && r.Method == http.MethodGet {
		s.getProjectGraph(w, r, user.ID, projectID)
		return
	}
	if len(parts) == 2 && parts[1] == "nodes" && r.Method == http.MethodPost {
		s.createExecutionNode(w, r, user.ID, projectID)
		return
	}
	if len(parts) == 2 && parts[1] == "collaboration-calls" {
		s.handleProjectCollaborationCalls(w, r, user.ID, projectID)
		return
	}
	if len(parts) == 2 && parts[1] == "planning-conversations" && r.Method == http.MethodPost {
		s.createPlanningConversation(w, r, user.ID, projectID)
		return
	}
	if len(parts) == 4 && parts[1] == "nodes" && parts[3] == "completion-conversations" && r.Method == http.MethodPost {
		s.createCompletionConversation(w, r, user.ID, projectID, parts[2])
		return
	}
	if len(parts) == 2 && parts[1] == "ai-key" && r.Method == http.MethodPost {
		s.setProjectAIKey(w, r, user.ID, projectID)
		return
	}
	if len(parts) == 2 && parts[1] == "smart-contract" && r.Method == http.MethodPost {
		s.setProjectSmartContract(w, r, user.ID, projectID)
		return
	}
	if len(parts) == 4 && parts[1] == "nodes" && parts[3] == "lock" && r.Method == http.MethodPost {
		s.lockExecutionNode(w, r, user.ID, projectID, parts[2])
		return
	}
	if len(parts) == 2 && parts[1] == "archive" && r.Method == http.MethodPost {
		s.archiveProject(w, r, user.ID, projectID)
		return
	}
	if len(parts) == 2 && parts[1] == "unarchive" && r.Method == http.MethodPost {
		s.unarchiveProject(w, r, user.ID, projectID)
		return
	}
	writeError(w, http.StatusNotFound, "项目接口不存在")
}

func (s *server) updateProject(w http.ResponseWriter, r *http.Request, userID uint64, projectID string) {
	var request updateProjectRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "请求格式不正确")
		return
	}
	title := strings.TrimSpace(request.Title)
	description := strings.TrimSpace(request.Description)
	if title == "" || description == "" {
		writeError(w, http.StatusBadRequest, "项目名称和描述不能为空")
		return
	}
	if len([]rune(title)) > 160 || len([]rune(description)) > 2000 {
		writeError(w, http.StatusBadRequest, "项目名称或描述过长")
		return
	}
	if request.Visibility != "private" && request.Visibility != "public" {
		writeError(w, http.StatusBadRequest, "项目可见性不正确")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	if request.Visibility == "private" {
		var adoptedCount int
		if err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM collaboration_submissions s JOIN completion_records r ON r.id = s.source_record_id WHERE r.project_id = ? AND s.status = 'adopted'`, projectID).Scan(&adoptedCount); err != nil {
			writeError(w, http.StatusInternalServerError, "读取协作来源失败")
			return
		}
		if adoptedCount > 0 {
			writeError(w, http.StatusBadRequest, "项目已有被外部采纳的公开成果，不能改为私人项目")
			return
		}
	}
	result, err := s.db.ExecContext(ctx, `UPDATE projects SET title = ?, description = ?, visibility = CASE WHEN is_default = 1 THEN 'private' ELSE ? END WHERE id = ? AND owner_id = ? AND archived_at IS NULL`, title, description, request.Visibility, projectID, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存项目资料失败")
		return
	}
	updated, _ := result.RowsAffected()
	if updated == 0 {
		writeError(w, http.StatusBadRequest, "项目不存在或已归档")
		return
	}
	s.writeProjectState(ctx, w, userID, projectID, http.StatusOK)
}

func (s *server) listProjects(w http.ResponseWriter, r *http.Request, userID uint64) {
	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	rows, err := s.db.QueryContext(ctx, `
		SELECT id FROM projects
		WHERE owner_id = ?
		ORDER BY is_default DESC, created_at DESC`, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取项目失败")
		return
	}
	defer rows.Close()

	projects := make([]projectResponse, 0)
	for rows.Next() {
		var projectID string
		if err := rows.Scan(&projectID); err != nil {
			writeError(w, http.StatusInternalServerError, "读取项目失败")
			return
		}
		project, err := s.loadProject(ctx, userID, projectID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "读取项目详情失败")
			return
		}
		projects = append(projects, project)
	}
	if err := rows.Err(); err != nil {
		writeError(w, http.StatusInternalServerError, "读取项目失败")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"projects": projects})
}

func (s *server) createProject(w http.ResponseWriter, r *http.Request, userID uint64) {
	var request createProjectRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "请求格式不正确")
		return
	}
	title := strings.TrimSpace(request.Title)
	description := strings.TrimSpace(request.Description)
	if len([]rune(title)) < 2 || len([]rune(title)) > 160 {
		writeError(w, http.StatusBadRequest, "项目名称长度需要在 2 到 160 个字符之间")
		return
	}
	if description == "" {
		writeError(w, http.StatusBadRequest, "请填写项目说明")
		return
	}
	visibility := strings.TrimSpace(request.Visibility)
	if visibility == "" {
		visibility = "private"
	}
	if visibility != "private" && visibility != "public" {
		writeError(w, http.StatusBadRequest, "项目可见性不正确")
		return
	}
	projectType := strings.TrimSpace(request.ProjectType)
	if projectType == "" {
		projectType = "guided"
	}
	if projectType != "guided" && projectType != "autonomous" {
		writeError(w, http.StatusBadRequest, "项目类型不正确")
		return
	}
	projectRules := strings.TrimSpace(request.ProjectRules)
	if projectType == "guided" && len([]rune(projectRules)) < 12 {
		writeError(w, http.StatusBadRequest, "规则引导型项目需要填写项目规则")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "创建项目失败")
		return
	}
	defer tx.Rollback()

	// Nodes retain a technical review snapshot, while guided behavior is
	// defined by projectRules and interpreted by AI for each action.
	smartContractID := generalSmartContractID
	var smartContractName, smartContractDescription, smartContractVersion, smartContractBody string
	err = tx.QueryRowContext(ctx, `
		SELECT name, description, version, body FROM smart_contracts
		WHERE id = ? AND deleted_at IS NULL AND (source = 'official' OR created_by = ?)`, smartContractID, userID).
		Scan(&smartContractName, &smartContractDescription, &smartContractVersion, &smartContractBody)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusBadRequest, "智能合约不存在或不可用")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取智能合约失败")
		return
	}
	projectID, err := newOpaqueID("project")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "生成项目编号失败")
		return
	}
	revisionID, err := newOpaqueID("project-revision")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "生成合约修订编号失败")
		return
	}
	aiKeyID := strings.TrimSpace(request.AIKeyID)
	if aiKeyID == "" {
		writeError(w, http.StatusBadRequest, "请选择项目审查 AI")
		return
	}
	var aiKeyExists bool
	if err := tx.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM ai_api_keys WHERE id = ? AND user_id = ?)`, aiKeyID, userID).Scan(&aiKeyExists); err != nil {
		writeError(w, http.StatusInternalServerError, "读取项目审查 AI 失败")
		return
	}
	if !aiKeyExists {
		writeError(w, http.StatusBadRequest, "项目审查 AI 不存在或不可用")
		return
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO projects
			(id, owner_id, title, description, project_type, project_rules, is_default, visibility, default_ai_key_id, active_contract_revision_id)
		VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`, projectID, userID, title, description, projectType, projectRules, visibility, aiKeyID, revisionID); err != nil {
		writeError(w, http.StatusInternalServerError, "创建项目失败")
		return
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO project_contract_revisions
			(id, project_id, smart_contract_id, smart_contract_version, rule_hash, reason, smart_contract_name, smart_contract_description, smart_contract_body)
		VALUES (?, ?, ?, ?, ?, '项目创建时的基础审查规则', ?, ?, ?)`,
		revisionID, projectID, smartContractID, smartContractVersion, hashValue(smartContractBody), smartContractName, smartContractDescription, smartContractBody); err != nil {
		writeError(w, http.StatusInternalServerError, "绑定项目智能合约失败")
		return
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "保存项目失败")
		return
	}
	project, err := s.loadProject(ctx, userID, projectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取新项目失败")
		return
	}
	writeJSON(w, http.StatusCreated, project)
}

func (s *server) getProject(w http.ResponseWriter, r *http.Request, userID uint64, projectID string) {
	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	project, err := s.loadProject(ctx, userID, projectID)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "项目不存在")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取项目失败")
		return
	}
	writeJSON(w, http.StatusOK, project)
}

func (s *server) loadProject(ctx context.Context, userID uint64, projectID string) (projectResponse, error) {
	var project projectResponse
	var isDefault int
	var currentContractID sql.NullString
	var activeRevisionID sql.NullString
	var archivedAt sql.NullTime
	if err := s.db.QueryRowContext(ctx, `
	SELECT id, title, description, project_type, COALESCE(project_rules, ''), is_default, visibility, default_ai_key_id, current_contract_id,
		       active_contract_revision_id, created_at, archived_at
		FROM projects WHERE id = ? AND owner_id = ?`, projectID, userID).
		Scan(&project.ID, &project.Title, &project.Description, &project.ProjectType, &project.ProjectRules, &isDefault, &project.Visibility,
			&project.ReviewAIKeyID, &currentContractID, &activeRevisionID, &project.CreatedAt, &archivedAt); err != nil {
		return project, err
	}
	project.IsDefault = isDefault == 1
	project.CurrentContractID = nullableString(currentContractID)
	if activeRevisionID.Valid {
		project.ActiveContractRevisionID = activeRevisionID.String
	}
	if archivedAt.Valid {
		value := archivedAt.Time
		project.ArchivedAt = &value
	}
	rows, err := s.db.QueryContext(ctx, `
		SELECT r.id, r.smart_contract_id, r.smart_contract_version, r.rule_hash, r.reason, r.activated_at,
		       COALESCE(r.smart_contract_name, c.name, ''), COALESCE(r.smart_contract_description, c.description, ''),
		       COALESCE(r.smart_contract_body, c.body, ''), COALESCE(c.source, 'custom'), COALESCE(c.created_at, r.activated_at)
		FROM project_contract_revisions r LEFT JOIN smart_contracts c ON c.id = r.smart_contract_id
		WHERE r.project_id = ? ORDER BY r.activated_at DESC`, projectID)
	if err != nil {
		return project, err
	}
	defer rows.Close()
	project.ContractRevisions = make([]projectRevisionResponse, 0)
	for rows.Next() {
		var revision projectRevisionResponse
		var contract smartContractResponse
		if err := rows.Scan(&revision.ID, &revision.SmartContractID, &revision.SmartContractVersion, &revision.RuleHash, &revision.Reason, &revision.ActivatedAt,
			&contract.Name, &contract.Description, &contract.Body, &contract.Source, &contract.CreatedAt); err != nil {
			return project, err
		}
		contract.ID = revision.SmartContractID
		contract.Version = revision.SmartContractVersion
		revision.SmartContract = &contract
		project.ContractRevisions = append(project.ContractRevisions, revision)
	}
	return project, rows.Err()
}

func (s *server) setProjectAIKey(w http.ResponseWriter, r *http.Request, userID uint64, projectID string) {
	var request setProjectAIKeyRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "请求格式不正确")
		return
	}
	keyID := strings.TrimSpace(request.AIKeyID)
	if keyID == "" {
		writeError(w, http.StatusBadRequest, "请选择项目审查 AI")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	result, err := s.db.ExecContext(ctx, `
		UPDATE projects p JOIN ai_api_keys k ON k.id = ? AND k.user_id = p.owner_id
		SET p.default_ai_key_id = k.id
		WHERE p.id = ? AND p.owner_id = ? AND p.archived_at IS NULL`, keyID, projectID, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "更新项目审查 AI 失败")
		return
	}
	updated, _ := result.RowsAffected()
	if updated == 0 {
		writeError(w, http.StatusBadRequest, "AI 密钥不可用，或项目已归档")
		return
	}
	project, err := s.loadProject(ctx, userID, projectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取项目失败")
		return
	}
	writeJSON(w, http.StatusOK, project)
}

func (s *server) setProjectSmartContract(w http.ResponseWriter, r *http.Request, userID uint64, projectID string) {
	writeError(w, http.StatusBadRequest, "项目行动合约由系统根据项目规则生成，不能手动指定")
}

func (s *server) archiveProject(w http.ResponseWriter, r *http.Request, userID uint64, projectID string) {
	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	result, err := s.db.ExecContext(ctx, `
		UPDATE projects SET archived_at = NOW()
		WHERE id = ? AND owner_id = ? AND is_default = 0 AND archived_at IS NULL`, projectID, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "归档项目失败")
		return
	}
	count, _ := result.RowsAffected()
	if count == 0 {
		writeError(w, http.StatusBadRequest, "默认项目不能归档，或项目已经归档")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "项目已归档"})
}

func (s *server) unarchiveProject(w http.ResponseWriter, r *http.Request, userID uint64, projectID string) {
	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	result, err := s.db.ExecContext(ctx, `
		UPDATE projects SET archived_at = NULL
		WHERE id = ? AND owner_id = ? AND is_default = 0 AND archived_at IS NOT NULL`, projectID, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "恢复项目失败")
		return
	}
	count, _ := result.RowsAffected()
	if count == 0 {
		writeError(w, http.StatusBadRequest, "默认项目不能恢复，或项目未归档")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "项目已恢复"})
}

func (s *server) deleteProject(w http.ResponseWriter, r *http.Request, userID uint64, projectID string) {
	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "删除项目失败")
		return
	}
	defer tx.Rollback()

	var isDefault int
	if err := tx.QueryRowContext(ctx, `
		SELECT is_default FROM projects
		WHERE id = ? AND owner_id = ?`, projectID, userID).Scan(&isDefault); err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "项目不存在")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "读取项目失败")
		return
	}
	if isDefault == 1 {
		writeError(w, http.StatusBadRequest, "默认项目不能删除")
		return
	}
	var adoptedCount int
	if err := tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM collaboration_submissions s JOIN completion_records r ON r.id = s.source_record_id WHERE r.project_id = ? AND s.status = 'adopted'`, projectID).Scan(&adoptedCount); err != nil {
		writeError(w, http.StatusInternalServerError, "读取协作来源失败")
		return
	}
	if adoptedCount > 0 {
		writeError(w, http.StatusBadRequest, "项目已有被外部采纳的成果，不能删除；可以归档保留历史")
		return
	}

	if _, err := tx.ExecContext(ctx, `
		DELETE FROM execution_edges
		WHERE source_contract_id IN (SELECT id FROM execution_contracts WHERE project_id = ?)
		   OR target_contract_id IN (SELECT id FROM execution_contracts WHERE project_id = ?)`, projectID, projectID); err != nil {
		writeError(w, http.StatusInternalServerError, "删除节点关系失败")
		return
	}
	if _, err := tx.ExecContext(ctx, `DELETE m FROM node_conversation_messages m JOIN node_conversations c ON c.id = m.conversation_id WHERE c.project_id = ?`, projectID); err != nil {
		writeError(w, http.StatusInternalServerError, "删除节点对话消息失败")
		return
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM node_conversations WHERE project_id = ?`, projectID); err != nil {
		writeError(w, http.StatusInternalServerError, "删除节点对话失败")
		return
	}
	statements := []string{
		`DELETE FROM completion_records WHERE project_id = ?`,
		`DELETE FROM execution_branches WHERE project_id = ?`,
		`DELETE FROM execution_contracts WHERE project_id = ?`,
		`DELETE FROM project_contract_revisions WHERE project_id = ?`,
		`DELETE FROM projects WHERE id = ? AND owner_id = ?`,
	}
	for _, statement := range statements[:len(statements)-1] {
		if _, err := tx.ExecContext(ctx, statement, projectID); err != nil {
			writeError(w, http.StatusInternalServerError, "删除项目失败")
			return
		}
	}
	result, err := tx.ExecContext(ctx, statements[len(statements)-1], projectID, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "删除项目失败")
		return
	}
	count, _ := result.RowsAffected()
	if count == 0 {
		writeError(w, http.StatusNotFound, "项目不存在")
		return
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "保存删除结果失败")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "项目已删除"})
}

func (s *server) getProjectGraph(w http.ResponseWriter, r *http.Request, userID uint64, projectID string) {
	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	s.writeProjectState(ctx, w, userID, projectID, http.StatusOK)
}

func (s *server) writeProjectState(ctx context.Context, w http.ResponseWriter, userID uint64, projectID string, status int) {
	project, err := s.loadProject(ctx, userID, projectID)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "项目不存在")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取项目失败")
		return
	}
	nodes, err := s.loadExecutionNodes(ctx, projectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取节点图失败")
		return
	}
	edges, err := s.loadExecutionEdges(ctx, nodes)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取节点关系失败")
		return
	}
	branches, err := s.loadExecutionBranches(ctx, projectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取节点路径失败")
		return
	}
	records, err := s.loadCompletionRecords(ctx, projectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取完成记录失败")
		return
	}
	writeJSON(w, status, map[string]any{"project": project, "nodes": nodes, "edges": edges, "branches": branches, "completionRecords": records})
}

func (s *server) loadExecutionNodes(ctx context.Context, projectID string) ([]executionNodeResponse, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, branch_id, project_contract_revision_id, parent_contract_id,
		       source_contract_ids_json, supplement_of_contract_id, actor_id, title, stage, original_intent,
		       smart_contract_id, smart_contract_version, rule_hash, verifiable_goal,
		       acceptance_criteria_json, evidence_requirement, completion_claim,
		       evidence_text, completion_record_id, draft_review_json, draft_review_ai_config_json,
			review_messages_json, ai_review_json, completion_review_ai_config_json, completion_review_rounds_json, planning_conversation_id, completion_conversation_id, user_verdict_json,
		       next_contract_title, created_at, updated_at
		FROM execution_contracts WHERE project_id = ? ORDER BY created_at ASC`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	nodes := make([]executionNodeResponse, 0)
	for rows.Next() {
		var node executionNodeResponse
		var branchID, parentID, supplementOfID, completionRecordID, nextTitle sql.NullString
		var actorID sql.NullInt64
		var sourceIDs, criteria, draftReview, draftReviewAIConfig, messages, aiReview, completionReviewAIConfig, completionReviewRounds, planningConversationID, completionConversationID, userVerdict sql.NullString
		var completionClaim, evidenceText sql.NullString
		if err := rows.Scan(
			&node.ID, &branchID, &node.ProjectContractRevisionID, &parentID, &sourceIDs, &supplementOfID, &actorID,
			&node.Title, &node.Stage, &node.OriginalIntent, &node.SmartContractID,
			&node.SmartContractVersion, &node.RuleHash, &node.VerifiableGoal, &criteria,
			&node.EvidenceRequirement, &completionClaim, &evidenceText, &completionRecordID,
			&draftReview, &draftReviewAIConfig, &messages, &aiReview, &completionReviewAIConfig, &completionReviewRounds, &planningConversationID, &completionConversationID, &userVerdict, &nextTitle,
			&node.CreatedAt, &node.UpdatedAt); err != nil {
			return nil, err
		}
		node.ProjectID = projectID
		node.BranchID = nullableString(branchID)
		node.ParentContractID = nullableString(parentID)
		node.SupplementOfContractID = nullableString(supplementOfID)
		node.CompletionClaim = nullableString(completionClaim)
		node.EvidenceText = nullableString(evidenceText)
		node.CompletionRecordID = nullableString(completionRecordID)
		node.NextContractTitle = nullableString(nextTitle)
		if actorID.Valid {
			value := uint64(actorID.Int64)
			node.ActorID = &value
		}
		node.SourceContractIDs = decodeJSONValue(sourceIDs.String, []string{})
		node.AcceptanceCriteria = decodeJSONValue(criteria.String, []any{})
		node.DraftReview = decodeOptionalJSON(draftReview)
		node.DraftReviewAIConfig = decodeOptionalJSON(draftReviewAIConfig)
		node.ReviewMessages = decodeJSONValue(messages.String, []any{})
		node.AIReview = decodeOptionalJSON(aiReview)
		node.CompletionReviewAIConfig = decodeOptionalJSON(completionReviewAIConfig)
		node.CompletionReviewRounds = decodeOptionalJSON(completionReviewRounds)
		node.PlanningConversationID = nullableString(planningConversationID)
		node.CompletionConversationID = nullableString(completionConversationID)
		node.UserVerdict = decodeOptionalJSON(userVerdict)
		nodes = append(nodes, node)
	}
	return nodes, rows.Err()
}

func (s *server) loadExecutionEdges(ctx context.Context, nodes []executionNodeResponse) ([]executionEdgeResponse, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, source_contract_id, target_contract_id, type, created_at
		FROM execution_edges ORDER BY created_at ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	projectNodeIDs := make(map[string]struct{}, len(nodes))
	for _, node := range nodes {
		projectNodeIDs[node.ID] = struct{}{}
	}
	edges := make([]executionEdgeResponse, 0)
	for rows.Next() {
		var edge executionEdgeResponse
		if err := rows.Scan(&edge.ID, &edge.SourceContractID, &edge.TargetContractID, &edge.Type, &edge.CreatedAt); err != nil {
			return nil, err
		}
		if _, ok := projectNodeIDs[edge.SourceContractID]; !ok {
			continue
		}
		if _, ok := projectNodeIDs[edge.TargetContractID]; !ok {
			continue
		}
		edges = append(edges, edge)
	}
	return edges, rows.Err()
}

func (s *server) loadExecutionBranches(ctx context.Context, projectID string) ([]executionBranchResponse, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, project_id, title, root_contract_id, forked_from_contract_id,
		       head_contract_id, current_contract_id, created_by, created_at
		FROM execution_branches WHERE project_id = ? ORDER BY created_at ASC`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	branches := make([]executionBranchResponse, 0)
	for rows.Next() {
		var branch executionBranchResponse
		var rootID, forkedID, headID, currentID sql.NullString
		if err := rows.Scan(&branch.ID, &branch.ProjectID, &branch.Title, &rootID, &forkedID, &headID, &currentID, &branch.CreatedByID, &branch.CreatedAt); err != nil {
			return nil, err
		}
		branch.RootContractID = nullableString(rootID)
		branch.ForkedFromContractID = nullableString(forkedID)
		branch.HeadContractID = nullableString(headID)
		branch.CurrentContractID = nullableString(currentID)
		branches = append(branches, branch)
	}
	return branches, rows.Err()
}

func (s *server) loadCompletionRecords(ctx context.Context, projectID string) ([]completionRecordResponse, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, project_id, closing_contract_id, covered_contract_ids_json, title, summary,
		       smart_contract_id, smart_contract_version, rule_hash, review_id,
		       ai_review_verdict, record_kind, user_verdict_json, created_at
		FROM completion_records WHERE project_id = ? ORDER BY created_at DESC`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	records := make([]completionRecordResponse, 0)
	for rows.Next() {
		var record completionRecordResponse
		var coveredIDs, userVerdict string
		if err := rows.Scan(
			&record.ID, &record.ProjectID, &record.ClosingContractID, &coveredIDs, &record.Title, &record.Summary,
			&record.SmartContractID, &record.SmartContractVersion, &record.RuleHash, &record.ReviewID,
			&record.AIReviewVerdict, &record.RecordKind, &userVerdict, &record.CreatedAt,
		); err != nil {
			return nil, err
		}
		if err := json.Unmarshal([]byte(coveredIDs), &record.CoveredContractIDs); err != nil {
			record.CoveredContractIDs = []string{}
		}
		record.UserVerdict = decodeJSONValue(userVerdict, nil)
		records = append(records, record)
	}
	return records, rows.Err()
}

func jsonValue(value any) (string, error) {
	encoded, err := json.Marshal(value)
	if err != nil {
		return "", err
	}
	return string(encoded), nil
}

func (s *server) createExecutionNode(w http.ResponseWriter, r *http.Request, userID uint64, projectID string) {
	var request createExecutionNodeRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "请求格式不正确")
		return
	}
	request.Title = strings.TrimSpace(request.Title)
	request.VerifiableGoal = strings.TrimSpace(request.VerifiableGoal)
	request.EvidenceRequirement = strings.TrimSpace(request.EvidenceRequirement)
	request.Draft = strings.TrimSpace(request.Draft)
	if request.DraftReview.Verdict != "pass" {
		writeError(w, http.StatusBadRequest, "节点草案必须先通过 AI 审核")
		return
	}
	if request.Title == "" || request.VerifiableGoal == "" || request.EvidenceRequirement == "" || request.Draft == "" || len(request.AcceptanceCriteria) == 0 {
		writeError(w, http.StatusBadRequest, "节点的目标、验收标准或证据要求不完整")
		return
	}
	for _, criterion := range request.AcceptanceCriteria {
		if strings.TrimSpace(criterion.ID) == "" || strings.TrimSpace(criterion.Text) == "" || strings.TrimSpace(criterion.RequiredEvidence) == "" {
			writeError(w, http.StatusBadRequest, "节点验收标准不完整")
			return
		}
	}

	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "创建节点失败")
		return
	}
	defer tx.Rollback()

	var archivedAt sql.NullTime
	var visibility, revisionID string
	var currentProjectNode sql.NullString
	err = tx.QueryRowContext(ctx, `
		SELECT visibility, active_contract_revision_id, current_contract_id, archived_at
		FROM projects WHERE id = ? AND owner_id = ? FOR UPDATE`, projectID, userID).
		Scan(&visibility, &revisionID, &currentProjectNode, &archivedAt)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "项目不存在")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取项目失败")
		return
	}
	if archivedAt.Valid {
		writeError(w, http.StatusBadRequest, "项目已归档，不能创建推进节点")
		return
	}
	draftAIConfig, err := s.loadProjectAIConfig(ctx, userID, projectID)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusBadRequest, "请先为项目选择审查 AI")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取项目审查 AI 失败")
		return
	}
	if request.DraftReview.AIConfig.KeyID != draftAIConfig.KeyID {
		writeError(w, http.StatusBadRequest, "项目审查 AI 已变更，请重新审核节点草案")
		return
	}

	var smartContractID, smartContractVersion, revisionHash string
	if err := tx.QueryRowContext(ctx, `
		SELECT smart_contract_id, smart_contract_version, rule_hash
		FROM project_contract_revisions WHERE id = ? AND project_id = ?`, revisionID, projectID).
		Scan(&smartContractID, &smartContractVersion, &revisionHash); err != nil {
		writeError(w, http.StatusInternalServerError, "读取项目智能合约失败")
		return
	}

	sourceIDs := uniqueNonEmpty(request.SourceContractIDs)
	if len(sourceIDs) == 0 && request.ParentContractID != "" {
		sourceIDs = []string{request.ParentContractID}
	}
	if len(sourceIDs) == 0 {
		var nodeCount int
		if err := tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM execution_contracts WHERE project_id = ?`, projectID).Scan(&nodeCount); err != nil {
			writeError(w, http.StatusInternalServerError, "读取节点失败")
			return
		}
		if nodeCount > 0 {
			writeError(w, http.StatusBadRequest, "后续推进必须从已锁定的完成记录继续或分叉")
			return
		}
	}

	isSupplement := strings.TrimSpace(request.SupplementOfNodeID) != ""
	isClosure := request.Closure && !isSupplement
	type sourceNode struct{ id, branchID string }
	sources := make([]sourceNode, 0, len(sourceIDs))
	for _, sourceID := range sourceIDs {
		var stage string
		var completionID, branchID sql.NullString
		err := tx.QueryRowContext(ctx, `
			SELECT stage, completion_record_id, branch_id
			FROM execution_contracts WHERE id = ? AND project_id = ? FOR UPDATE`, sourceID, projectID).
			Scan(&stage, &completionID, &branchID)
		isSupplementSource := isSupplement && len(sourceIDs) == 1 && sourceID == request.SupplementOfNodeID && stage == "needs_supplement"
		isClosureSource := isClosure && len(sourceIDs) == 1 && stage == "frozen"
		if err == sql.ErrNoRows || (!isSupplementSource && !isClosureSource && (stage != "completed" || !completionID.Valid)) {
			writeError(w, http.StatusBadRequest, "节点只能从同一项目已锁定的完成记录继续，或处理 AI 指出的补足缺口")
			return
		}
		if err != nil {
			writeError(w, http.StatusInternalServerError, "读取来源节点失败")
			return
		}
		sources = append(sources, sourceNode{id: sourceID, branchID: branchID.String})
	}

	nodeID, err := newOpaqueID("node")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "生成节点编号失败")
		return
	}
	parentID := ""
	if len(sourceIDs) == 1 {
		parentID = sourceIDs[0]
	}
	branchID := ""
	createBranch := false
	if len(sourceIDs) == 0 {
		createBranch = visibility == "public"
	} else if len(sourceIDs) > 1 {
		if currentProjectNode.Valid {
			writeError(w, http.StatusBadRequest, "请先结算当前推进，再开始汇合行动")
			return
		}
	} else if request.Fork {
		createBranch = true
	} else if request.BranchID != "" {
		branchID = request.BranchID
	} else {
		branchID = sources[0].branchID
	}

	if branchID != "" {
		var headID, currentID sql.NullString
		err := tx.QueryRowContext(ctx, `
			SELECT head_contract_id, current_contract_id FROM execution_branches
			WHERE id = ? AND project_id = ? FOR UPDATE`, branchID, projectID).Scan(&headID, &currentID)
		allowsReplacingSource := (isSupplement || isClosure) && currentID.Valid && currentID.String == parentID
		if err == sql.ErrNoRows || !headID.Valid || headID.String != parentID || (currentID.Valid && !allowsReplacingSource) {
			writeError(w, http.StatusBadRequest, "这条节点路径已经不是可继续的末端")
			return
		}
		if err != nil {
			writeError(w, http.StatusInternalServerError, "读取节点路径失败")
			return
		}
	} else if !createBranch && currentProjectNode.Valid && !((isSupplement || isClosure) && currentProjectNode.String == parentID) {
		writeError(w, http.StatusBadRequest, "项目当前还有一项推进等待处理")
		return
	}

	if createBranch {
		branchID, err = newOpaqueID("branch")
		if err != nil {
			writeError(w, http.StatusInternalServerError, "生成节点路径失败")
			return
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO execution_branches
				(id, project_id, title, root_contract_id, forked_from_contract_id, head_contract_id, current_contract_id, created_by)
			VALUES (?, ?, ?, ?, NULLIF(?, ''), ?, ?, ?)`,
			branchID, projectID, request.Title, nodeID, parentID, nodeID, nodeID, userID); err != nil {
			writeError(w, http.StatusInternalServerError, "创建节点路径失败")
			return
		}
	}

	criteriaJSON, err := jsonValue(request.AcceptanceCriteria)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存验收标准失败")
		return
	}
	sourceJSON, err := jsonValue(sourceIDs)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存来源节点失败")
		return
	}
	draftReviewJSON, err := jsonValue(request.DraftReview)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存草案审核失败")
		return
	}
	draftAIConfigJSON, err := jsonValue(draftAIConfig)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存草案审核配置失败")
		return
	}
	ruleHash := hashValue(fmt.Sprintf("%s|%s|%s|%s|%s", projectID, revisionHash, request.VerifiableGoal, criteriaJSON, request.EvidenceRequirement))
	messageID, err := newOpaqueID("message")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "生成节点消息失败")
		return
	}
	messagesJSON, err := jsonValue([]map[string]any{{
		"id": messageID, "speaker": "ai",
		"body":      "推进节点已通过 AI 草案审核，目标、验收标准和证据要求已冻结。",
		"createdAt": time.Now(),
	}})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存节点消息失败")
		return
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO execution_contracts
			(id, project_id, branch_id, project_contract_revision_id, parent_contract_id, source_contract_ids_json, supplement_of_contract_id,
			 actor_id, title, stage, original_intent, smart_contract_id, smart_contract_version, rule_hash,
			 verifiable_goal, acceptance_criteria_json, evidence_requirement, draft_review_json, draft_review_ai_config_json, review_messages_json, planning_conversation_id)
		VALUES (?, ?, NULLIF(?, ''), ?, NULLIF(?, ''), ?, NULLIF(?, ''), ?, ?, 'frozen', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULLIF(?, ''))`,
		nodeID, projectID, branchID, revisionID, parentID, sourceJSON, request.SupplementOfNodeID, userID, request.Title, request.Draft,
		smartContractID, smartContractVersion, ruleHash, request.VerifiableGoal, criteriaJSON, request.EvidenceRequirement,
		draftReviewJSON, draftAIConfigJSON, messagesJSON, request.PlanningConversationID); err != nil {
		writeError(w, http.StatusInternalServerError, "保存推进节点失败")
		return
	}
	for _, sourceID := range sourceIDs {
		edgeID, err := newOpaqueID("edge")
		if err != nil {
			writeError(w, http.StatusInternalServerError, "生成节点关系失败")
			return
		}
		edgeType := "lineage"
		if isSupplement {
			edgeType = "supplement"
		} else if isClosure {
			edgeType = "closure"
		} else if createBranch {
			edgeType = "fork"
		} else if len(sourceIDs) > 1 {
			edgeType = "merge"
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO execution_edges (id, source_contract_id, target_contract_id, type) VALUES (?, ?, ?, ?)`, edgeID, sourceID, nodeID, edgeType); err != nil {
			writeError(w, http.StatusInternalServerError, "保存节点关系失败")
			return
		}
	}
	if branchID != "" && !createBranch {
		if _, err := tx.ExecContext(ctx, `UPDATE execution_branches SET head_contract_id = ?, current_contract_id = ? WHERE id = ?`, nodeID, nodeID, branchID); err != nil {
			writeError(w, http.StatusInternalServerError, "更新节点路径失败")
			return
		}
	}
	if branchID == "" {
		if _, err := tx.ExecContext(ctx, `UPDATE projects SET current_contract_id = ? WHERE id = ?`, nodeID, projectID); err != nil {
			writeError(w, http.StatusInternalServerError, "更新项目当前节点失败")
			return
		}
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "保存推进节点失败")
		return
	}
	if request.PlanningConversationID != "" {
		_, _ = s.db.ExecContext(ctx, `UPDATE node_conversations SET node_id = ?, status = 'frozen' WHERE id = ? AND project_id = ? AND owner_id = ?`, nodeID, request.PlanningConversationID, projectID, userID)
		s.copyPlanningConversationToNodeMessages(ctx, request.PlanningConversationID, nodeID, userID)
	}
	s.writeProjectState(ctx, w, userID, projectID, http.StatusCreated)
}

func uniqueNonEmpty(values []string) []string {
	result := make([]string, 0, len(values))
	seen := make(map[string]struct{})
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

func (s *server) lockExecutionNode(w http.ResponseWriter, r *http.Request, userID uint64, projectID, nodeID string) {
	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "锁定节点失败")
		return
	}
	defer tx.Rollback()

	var archivedAt sql.NullTime
	if err := tx.QueryRowContext(ctx, `SELECT archived_at FROM projects WHERE id = ? AND owner_id = ? FOR UPDATE`, projectID, userID).Scan(&archivedAt); err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "项目不存在")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "读取项目失败")
		return
	}
	if archivedAt.Valid {
		writeError(w, http.StatusBadRequest, "项目已归档，不能锁定节点")
		return
	}

	var stage, title, smartContractID, smartContractVersion, ruleHash, aiReviewJSON, messagesJSON string
	var branchID, currentProjectNode sql.NullString
	if err := tx.QueryRowContext(ctx, `
		SELECT n.stage, n.title, n.branch_id, n.smart_contract_id, n.smart_contract_version,
		       n.rule_hash, n.ai_review_json, n.review_messages_json, p.current_contract_id
		FROM execution_contracts n JOIN projects p ON p.id = n.project_id
		WHERE n.id = ? AND n.project_id = ? AND p.owner_id = ? FOR UPDATE`, nodeID, projectID, userID).
		Scan(&stage, &title, &branchID, &smartContractID, &smartContractVersion, &ruleHash, &aiReviewJSON, &messagesJSON, &currentProjectNode); err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "节点不存在")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "读取节点失败")
		return
	}
	if stage != "verified" && stage != "needs_supplement" {
		writeError(w, http.StatusBadRequest, "节点尚未获得 AI 审查结果")
		return
	}
	if !branchID.Valid && (!currentProjectNode.Valid || currentProjectNode.String != nodeID) {
		writeError(w, http.StatusBadRequest, "该节点不是项目当前待确认节点")
		return
	}
	if branchID.Valid {
		var currentBranchNode sql.NullString
		if err := tx.QueryRowContext(ctx, `SELECT current_contract_id FROM execution_branches WHERE id = ? AND project_id = ? FOR UPDATE`, branchID.String, projectID).Scan(&currentBranchNode); err != nil || !currentBranchNode.Valid || currentBranchNode.String != nodeID {
			writeError(w, http.StatusBadRequest, "该节点不是路径当前待确认节点")
			return
		}
	}

	var review aiReviewResponse
	if err := json.Unmarshal([]byte(aiReviewJSON), &review); err != nil || review.ID == "" {
		writeError(w, http.StatusBadRequest, "节点没有可锁定的 AI 审查记录")
		return
	}
	// A completion review currently assesses one frozen node. Never infer an
	// ancestor scope from graph topology: that could lock evidence AI never saw.
	coveredIDs := []string{nodeID}

	createdAt := time.Now()
	verdict := map[string]any{}
	summary := ""
	message := ""
	recordKind := "accepted"
	terminalStage := "completed"
	if review.Verdict == "pass" {
		verdict = map[string]any{"result": "confirmed_complete", "note": "我确认 AI 审查通过的结果属实，并签名锁定这次推进覆盖的节点。", "createdAt": createdAt}
		summary = fmt.Sprintf("智能合约审查通过，并由本人确认；这条完成记录覆盖 %d 个推进节点。", len(coveredIDs))
		message = "我签名确认：AI 审查通过，并锁定这次推进覆盖的节点。"
	} else {
		recordKind = "sealed"
		terminalStage = "sealed"
		verdict = map[string]any{"result": "sealed_with_ai_gap", "note": "我已看到 AI 审查指出的缺口，决定封存这次推进；它不会作为已验收成果使用。", "createdAt": createdAt}
		summary = fmt.Sprintf("AI 审查仍有缺口，本人决定封存这次推进；保留 %d 个行动节点及其证据，但不记为已验收成果。", len(coveredIDs))
		message = "我已看到 AI 审查指出的缺口，决定封存这次推进并保留全部证据。"
	}
	verdictJSON, err := jsonValue(verdict)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存用户确认失败")
		return
	}
	var messages []any
	_ = json.Unmarshal([]byte(messagesJSON), &messages)
	messageID, err := newOpaqueID("message")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "生成确认消息失败")
		return
	}
	messages = append(messages, map[string]any{"id": messageID, "speaker": "user", "body": message, "createdAt": createdAt})
	updatedMessagesJSON, err := jsonValue(messages)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存确认消息失败")
		return
	}
	recordID, err := newOpaqueID("record")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "生成完成记录失败")
		return
	}
	coveredJSON, err := jsonValue(coveredIDs)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存完成范围失败")
		return
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO completion_records
			(id, project_id, closing_contract_id, covered_contract_ids_json, title, summary,
			 smart_contract_id, smart_contract_version, rule_hash, review_id, ai_review_verdict, record_kind, user_verdict_json)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		recordID, projectID, nodeID, coveredJSON, title, summary, smartContractID, smartContractVersion, ruleHash, review.ID, review.Verdict, recordKind, verdictJSON); err != nil {
		writeError(w, http.StatusInternalServerError, "写入完成记录失败")
		return
	}
	for _, coveredID := range coveredIDs {
		if _, err := tx.ExecContext(ctx, `UPDATE execution_contracts SET stage = ?, completion_record_id = ? WHERE id = ? AND project_id = ?`, terminalStage, recordID, coveredID, projectID); err != nil {
			writeError(w, http.StatusInternalServerError, "锁定节点失败")
			return
		}
	}
	if _, err := tx.ExecContext(ctx, `UPDATE node_conversations SET status = 'closed' WHERE project_id = ? AND node_id = ? AND owner_id = ? AND phase = 'completion' AND status = 'active'`, projectID, nodeID, userID); err != nil {
		writeError(w, http.StatusInternalServerError, "关闭节点审查对话失败")
		return
	}
	if _, err := tx.ExecContext(ctx, `UPDATE execution_contracts SET user_verdict_json = ?, review_messages_json = ? WHERE id = ?`, verdictJSON, updatedMessagesJSON, nodeID); err != nil {
		writeError(w, http.StatusInternalServerError, "保存节点确认失败")
		return
	}
	if branchID.Valid {
		if _, err := tx.ExecContext(ctx, `UPDATE execution_branches SET head_contract_id = ?, current_contract_id = NULL WHERE id = ?`, nodeID, branchID.String); err != nil {
			writeError(w, http.StatusInternalServerError, "更新节点路径失败")
			return
		}
	} else if _, err := tx.ExecContext(ctx, `UPDATE projects SET current_contract_id = NULL WHERE id = ? AND current_contract_id = ?`, projectID, nodeID); err != nil {
		writeError(w, http.StatusInternalServerError, "更新项目当前节点失败")
		return
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "锁定节点失败")
		return
	}
	s.writeProjectState(ctx, w, userID, projectID, http.StatusOK)
}

func (s *server) handleSmartContracts(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requireUser(w, r)
	if !ok {
		return
	}
	remainder := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/smart-contracts"), "/")
	if remainder == "" {
		if r.Method == http.MethodGet {
			s.listSmartContracts(w, r, user.ID)
			return
		}
		if r.Method == http.MethodPost {
			s.createSmartContract(w, r, user.ID)
			return
		}
	}
	if remainder == "history" && r.Method == http.MethodGet {
		s.listSmartContractEvents(w, r, user.ID)
		return
	}
	if remainder != "" && r.Method == http.MethodDelete {
		s.deleteSmartContract(w, r, user.ID, strings.Split(remainder, "/")[0])
		return
	}
	if remainder != "" && r.Method == http.MethodGet {
		s.getSmartContract(w, r, user.ID, strings.Split(remainder, "/")[0])
		return
	}
	writeError(w, http.StatusNotFound, "智能合约接口不存在")
}

func (s *server) listSmartContracts(w http.ResponseWriter, r *http.Request, userID uint64) {
	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, name, source, version, description, body, created_at
		FROM smart_contracts
		WHERE deleted_at IS NULL AND (source = 'official' OR created_by = ?)
		ORDER BY source ASC, created_at ASC`, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取智能合约失败")
		return
	}
	defer rows.Close()
	contracts := make([]smartContractResponse, 0)
	for rows.Next() {
		var contract smartContractResponse
		if err := rows.Scan(&contract.ID, &contract.Name, &contract.Source, &contract.Version, &contract.Description, &contract.Body, &contract.CreatedAt); err != nil {
			writeError(w, http.StatusInternalServerError, "读取智能合约失败")
			return
		}
		contracts = append(contracts, contract)
	}
	if err := rows.Err(); err != nil {
		writeError(w, http.StatusInternalServerError, "读取智能合约失败")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"smartContracts": contracts})
}

func (s *server) getSmartContract(w http.ResponseWriter, r *http.Request, userID uint64, contractID string) {
	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	var contract smartContractResponse
	err := s.db.QueryRowContext(ctx, `
		SELECT id, name, source, version, description, body, created_at
		FROM smart_contracts
		WHERE id = ? AND deleted_at IS NULL AND (source = 'official' OR created_by = ?)`, contractID, userID).
		Scan(&contract.ID, &contract.Name, &contract.Source, &contract.Version, &contract.Description, &contract.Body, &contract.CreatedAt)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "智能合约不存在")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取智能合约失败")
		return
	}
	writeJSON(w, http.StatusOK, contract)
}

func (s *server) createSmartContract(w http.ResponseWriter, r *http.Request, userID uint64) {
	var request struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		Body        string `json:"body"`
	}
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "请求格式不正确")
		return
	}
	name := strings.TrimSpace(request.Name)
	description := strings.TrimSpace(request.Description)
	body := strings.TrimSpace(request.Body)
	if len([]rune(name)) < 2 || body == "" {
		writeError(w, http.StatusBadRequest, "请填写合约名称和 Markdown 正文")
		return
	}
	contractID, err := newOpaqueID("smart-contract")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "生成智能合约编号失败")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	createdAt := time.Now()
	contract := smartContractResponse{ID: contractID, Name: name, Source: "custom", Version: "1.0.0", Description: description, Body: body, CreatedAt: createdAt}
	snapshotJSON, err := jsonValue(contract)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存智能合约记录失败")
		return
	}
	eventID, err := newOpaqueID("contract-event")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "生成智能合约记录编号失败")
		return
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "创建智能合约失败")
		return
	}
	defer tx.Rollback()
	_, err = tx.ExecContext(ctx, `
		INSERT INTO smart_contracts (id, name, source, version, description, body, created_by)
		VALUES (?, ?, 'custom', '1.0.0', ?, ?, ?)`, contractID, name, description, body, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "创建智能合约失败")
		return
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO smart_contract_events (id, contract_id, actor_id, event_type, contract_snapshot_json, created_at)
		VALUES (?, ?, ?, 'created', ?, ?)`, eventID, contractID, userID, snapshotJSON, createdAt); err != nil {
		writeError(w, http.StatusInternalServerError, "保存智能合约记录失败")
		return
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "创建智能合约失败")
		return
	}
	writeJSON(w, http.StatusCreated, contract)
}

func (s *server) deleteSmartContract(w http.ResponseWriter, r *http.Request, userID uint64, contractID string) {
	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "删除智能合约失败")
		return
	}
	defer tx.Rollback()
	var contract smartContractResponse
	err = tx.QueryRowContext(ctx, `
		SELECT id, name, source, version, description, body, created_at
		FROM smart_contracts WHERE id = ? AND created_by = ? AND source = 'custom' AND deleted_at IS NULL FOR UPDATE`, contractID, userID).
		Scan(&contract.ID, &contract.Name, &contract.Source, &contract.Version, &contract.Description, &contract.Body, &contract.CreatedAt)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "自定义智能合约不存在或已经删除")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取智能合约失败")
		return
	}
	var activeProjectCount int
	if err := tx.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM projects p JOIN project_contract_revisions r ON r.id = p.active_contract_revision_id
		WHERE p.owner_id = ? AND r.smart_contract_id = ?`, userID, contractID).Scan(&activeProjectCount); err != nil {
		writeError(w, http.StatusInternalServerError, "读取项目智能合约失败")
		return
	}
	if activeProjectCount > 0 {
		writeError(w, http.StatusBadRequest, "该合约正在被项目使用，请先修改项目智能合约")
		return
	}
	snapshotJSON, err := jsonValue(contract)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存智能合约记录失败")
		return
	}
	eventID, err := newOpaqueID("contract-event")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "生成智能合约记录编号失败")
		return
	}
	deletedAt := time.Now()
	if _, err := tx.ExecContext(ctx, `UPDATE smart_contracts SET deleted_at = ?, deleted_by = ? WHERE id = ?`, deletedAt, userID, contractID); err != nil {
		writeError(w, http.StatusInternalServerError, "删除智能合约失败")
		return
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO smart_contract_events (id, contract_id, actor_id, event_type, contract_snapshot_json, created_at)
		VALUES (?, ?, ?, 'deleted', ?, ?)`, eventID, contractID, userID, snapshotJSON, deletedAt); err != nil {
		writeError(w, http.StatusInternalServerError, "保存智能合约记录失败")
		return
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "删除智能合约失败")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *server) listSmartContractEvents(w http.ResponseWriter, r *http.Request, userID uint64) {
	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, contract_id, event_type, contract_snapshot_json, created_at
		FROM smart_contract_events WHERE actor_id = ? ORDER BY created_at DESC`, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取智能合约记录失败")
		return
	}
	defer rows.Close()
	events := make([]smartContractEventResponse, 0)
	for rows.Next() {
		var event smartContractEventResponse
		var snapshotJSON string
		if err := rows.Scan(&event.ID, &event.ContractID, &event.EventType, &snapshotJSON, &event.CreatedAt); err != nil {
			writeError(w, http.StatusInternalServerError, "读取智能合约记录失败")
			return
		}
		if err := json.Unmarshal([]byte(snapshotJSON), &event.SmartContract); err != nil {
			writeError(w, http.StatusInternalServerError, "智能合约记录已损坏")
			return
		}
		events = append(events, event)
	}
	if err := rows.Err(); err != nil {
		writeError(w, http.StatusInternalServerError, "读取智能合约记录失败")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"events": events})
}

func nullableString(value sql.NullString) *string {
	if !value.Valid {
		return nil
	}
	return &value.String
}

func decodeOptionalJSON(value sql.NullString) any {
	if !value.Valid || strings.TrimSpace(value.String) == "" {
		return nil
	}
	return decodeJSONValue(value.String, nil)
}

func decodeJSONValue(value string, fallback any) any {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	var decoded any
	if err := json.Unmarshal([]byte(value), &decoded); err != nil {
		return fallback
	}
	return decoded
}
