package app

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

type createProjectRequest struct {
	Title           string `json:"title"`
	Description     string `json:"description"`
	Visibility      string `json:"visibility"`
	SmartContractID string `json:"smartContractId"`
}

type projectRevisionResponse struct {
	ID                   string    `json:"id"`
	SmartContractID      string    `json:"smartContractId"`
	SmartContractVersion string    `json:"smartContractVersion"`
	RuleHash             string    `json:"ruleHash"`
	Reason               string    `json:"reason"`
	ActivatedAt          time.Time `json:"activatedAt"`
}

type projectResponse struct {
	ID                       string                    `json:"id"`
	Title                    string                    `json:"title"`
	Description              string                    `json:"description"`
	IsDefault                bool                      `json:"isDefault"`
	Visibility               string                    `json:"visibility"`
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

type executionNodeResponse struct {
	ID                        string    `json:"id"`
	ProjectID                 string    `json:"projectId"`
	BranchID                  *string   `json:"branchId,omitempty"`
	ProjectContractRevisionID string    `json:"projectContractRevisionId"`
	ParentContractID          *string   `json:"parentContractId,omitempty"`
	SourceContractIDs         any       `json:"sourceContractIds,omitempty"`
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
	ReviewMessages            any       `json:"reviewMessages"`
	AIReview                  any       `json:"aiReview,omitempty"`
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
	if len(parts) == 1 && r.Method == http.MethodGet {
		s.getProject(w, r, user.ID, projectID)
		return
	}
	if len(parts) == 2 && parts[1] == "graph" && r.Method == http.MethodGet {
		s.getProjectGraph(w, r, user.ID, projectID)
		return
	}
	if len(parts) == 2 && parts[1] == "archive" && r.Method == http.MethodPost {
		s.archiveProject(w, r, user.ID, projectID)
		return
	}
	writeError(w, http.StatusNotFound, "项目接口不存在")
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

	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "创建项目失败")
		return
	}
	defer tx.Rollback()

	smartContractID := strings.TrimSpace(request.SmartContractID)
	if smartContractID == "" {
		smartContractID = generalSmartContractID
	}
	var smartContractVersion, smartContractBody string
	err = tx.QueryRowContext(ctx, `
		SELECT version, body FROM smart_contracts
		WHERE id = ? AND (source = 'official' OR created_by = ?)`, smartContractID, userID).
		Scan(&smartContractVersion, &smartContractBody)
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
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO projects
			(id, owner_id, title, description, is_default, visibility, active_contract_revision_id)
		VALUES (?, ?, ?, ?, 0, ?, ?)`, projectID, userID, title, description, visibility, revisionID); err != nil {
		writeError(w, http.StatusInternalServerError, "创建项目失败")
		return
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO project_contract_revisions
			(id, project_id, smart_contract_id, smart_contract_version, rule_hash, reason)
		VALUES (?, ?, ?, ?, ?, '项目创建时选择的智能合约')`,
		revisionID, projectID, smartContractID, smartContractVersion, hashValue(smartContractBody)); err != nil {
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
		SELECT id, title, description, is_default, visibility, current_contract_id,
		       active_contract_revision_id, created_at, archived_at
		FROM projects WHERE id = ? AND owner_id = ?`, projectID, userID).
		Scan(&project.ID, &project.Title, &project.Description, &isDefault, &project.Visibility,
			&currentContractID, &activeRevisionID, &project.CreatedAt, &archivedAt); err != nil {
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
		SELECT id, smart_contract_id, smart_contract_version, rule_hash, reason, activated_at
		FROM project_contract_revisions WHERE project_id = ? ORDER BY activated_at DESC`, projectID)
	if err != nil {
		return project, err
	}
	defer rows.Close()
	project.ContractRevisions = make([]projectRevisionResponse, 0)
	for rows.Next() {
		var revision projectRevisionResponse
		if err := rows.Scan(&revision.ID, &revision.SmartContractID, &revision.SmartContractVersion, &revision.RuleHash, &revision.Reason, &revision.ActivatedAt); err != nil {
			return project, err
		}
		project.ContractRevisions = append(project.ContractRevisions, revision)
	}
	return project, rows.Err()
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

func (s *server) getProjectGraph(w http.ResponseWriter, r *http.Request, userID uint64, projectID string) {
	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	if _, err := s.loadProject(ctx, userID, projectID); err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "项目不存在")
		return
	} else if err != nil {
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
	writeJSON(w, http.StatusOK, map[string]any{"nodes": nodes, "edges": edges})
}

func (s *server) loadExecutionNodes(ctx context.Context, projectID string) ([]executionNodeResponse, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, branch_id, project_contract_revision_id, parent_contract_id,
		       source_contract_ids_json, actor_id, title, stage, original_intent,
		       smart_contract_id, smart_contract_version, rule_hash, verifiable_goal,
		       acceptance_criteria_json, evidence_requirement, completion_claim,
		       evidence_text, completion_record_id, draft_review_json,
		       review_messages_json, ai_review_json, user_verdict_json,
		       next_contract_title, created_at, updated_at
		FROM execution_contracts WHERE project_id = ? ORDER BY created_at ASC`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	nodes := make([]executionNodeResponse, 0)
	for rows.Next() {
		var node executionNodeResponse
		var branchID, parentID, completionRecordID, nextTitle sql.NullString
		var actorID sql.NullInt64
		var sourceIDs, criteria, draftReview, messages, aiReview, userVerdict sql.NullString
		var completionClaim, evidenceText sql.NullString
		if err := rows.Scan(
			&node.ID, &branchID, &node.ProjectContractRevisionID, &parentID, &sourceIDs, &actorID,
			&node.Title, &node.Stage, &node.OriginalIntent, &node.SmartContractID,
			&node.SmartContractVersion, &node.RuleHash, &node.VerifiableGoal, &criteria,
			&node.EvidenceRequirement, &completionClaim, &evidenceText, &completionRecordID,
			&draftReview, &messages, &aiReview, &userVerdict, &nextTitle,
			&node.CreatedAt, &node.UpdatedAt); err != nil {
			return nil, err
		}
		node.ProjectID = projectID
		node.BranchID = nullableString(branchID)
		node.ParentContractID = nullableString(parentID)
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
		node.ReviewMessages = decodeJSONValue(messages.String, []any{})
		node.AIReview = decodeOptionalJSON(aiReview)
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
		WHERE source = 'official' OR created_by = ?
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
		WHERE id = ? AND (source = 'official' OR created_by = ?)`, contractID, userID).
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
	_, err = s.db.ExecContext(ctx, `
		INSERT INTO smart_contracts (id, name, source, version, description, body, created_by)
		VALUES (?, ?, 'custom', '1.0.0', ?, ?, ?)`, contractID, name, description, body, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "创建智能合约失败")
		return
	}
	smartContract := smartContractResponse{
		ID: contractID, Name: name, Source: "custom", Version: "1.0.0",
		Description: description, Body: body, CreatedAt: time.Now(),
	}
	writeJSON(w, http.StatusCreated, smartContract)
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
