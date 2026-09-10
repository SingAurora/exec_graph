package app

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type reviewCriterionRequest struct {
	ID               string `json:"id"`
	Text             string `json:"text"`
	RequiredEvidence string `json:"requiredEvidence"`
}

type reviewSmartContractRequest struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Body        string `json:"body"`
}

type reviewProjectRequest struct {
	ID           string `json:"id"`
	Title        string `json:"title"`
	Description  string `json:"description"`
	ProjectRules string `json:"projectRules,omitempty"`
}

type reviewExecutionNodeRequest struct {
	Project             reviewProjectRequest         `json:"project"`
	SmartContract       reviewSmartContractRequest   `json:"smartContract"`
	NodeID              string                       `json:"nodeId"`
	Title               string                       `json:"title"`
	OriginalIntent      string                       `json:"originalIntent"`
	VerifiableGoal      string                       `json:"verifiableGoal"`
	AcceptanceCriteria  []reviewCriterionRequest     `json:"acceptanceCriteria"`
	EvidenceRequirement string                       `json:"evidenceRequirement"`
	CompletionClaim     string                       `json:"completionClaim"`
	EvidenceText        string                       `json:"evidenceText"`
	PriorReview         *aiReviewResponse            `json:"priorReview,omitempty"`
	Clarification       *reviewClarificationResponse `json:"clarification,omitempty"`
}

type reviewClarificationRequest struct {
	NodeID             string   `json:"nodeId"`
	CriterionIDs       []string `json:"criterionIds"`
	Explanation        string   `json:"explanation"`
	EvidenceReferences string   `json:"evidenceReferences"`
}

type reviewClarificationResponse struct {
	ID                 string    `json:"id"`
	CriterionIDs       []string  `json:"criterionIds"`
	Explanation        string    `json:"explanation"`
	EvidenceReferences string    `json:"evidenceReferences,omitempty"`
	CreatedAt          time.Time `json:"createdAt"`
}

type completionReviewRoundResponse struct {
	ID            string                       `json:"id"`
	Kind          string                       `json:"kind"`
	Clarification *reviewClarificationResponse `json:"clarification,omitempty"`
	Review        aiReviewResponse             `json:"review"`
	AIConfig      aiConfigSnapshot             `json:"aiConfig"`
	CreatedAt     time.Time                    `json:"createdAt"`
}

type reviewNodeDraftRequest struct {
	Project             reviewProjectRequest       `json:"project"`
	SmartContract       reviewSmartContractRequest `json:"smartContract"`
	Draft               string                     `json:"draft"`
	Title               string                     `json:"title"`
	VerifiableGoal      string                     `json:"verifiableGoal"`
	AcceptanceCriteria  []string                   `json:"acceptanceCriteria"`
	EvidenceRequirement string                     `json:"evidenceRequirement"`
}

type criterionReviewResponse struct {
	CriterionID string `json:"criterionId"`
	Result      string `json:"result"`
	Reason      string `json:"reason"`
}

type aiReviewResponse struct {
	ID                       string                    `json:"id"`
	Verdict                  string                    `json:"verdict"`
	Summary                  string                    `json:"summary"`
	CriterionReviews         []criterionReviewResponse `json:"criterionReviews"`
	SuggestedSupplementTitle string                    `json:"suggestedSupplementTitle,omitempty"`
	CreatedAt                time.Time                 `json:"createdAt"`
	AIConfig                 aiConfigSnapshot          `json:"aiConfig"`
}

type aiStoredKey struct {
	ID       string
	Provider string
	Label    string
	APIKey   string
	BaseURL  string
	Model    string
}

type aiConfigSnapshot struct {
	KeyID    string `json:"keyId"`
	Label    string `json:"label"`
	Provider string `json:"provider"`
	Model    string `json:"model"`
	BaseURL  string `json:"baseUrl"`
}

func (key aiStoredKey) snapshot() aiConfigSnapshot {
	return aiConfigSnapshot{KeyID: key.ID, Label: key.Label, Provider: key.Provider, Model: key.Model, BaseURL: key.BaseURL}
}

type aiReviewModelOutput struct {
	Verdict                  string                    `json:"verdict"`
	Summary                  string                    `json:"summary"`
	CriterionReviews         []criterionReviewResponse `json:"criterionReviews"`
	SuggestedSupplementTitle string                    `json:"suggestedSupplementTitle"`
}

type nodeDraftReviewResponse struct {
	ID                  string           `json:"id"`
	Verdict             string           `json:"verdict"`
	Summary             string           `json:"summary"`
	MissingRequirements []string         `json:"missingRequirements"`
	CreatedAt           time.Time        `json:"createdAt"`
	AIConfig            aiConfigSnapshot `json:"aiConfig"`
}

type nodeDraftReviewModelOutput struct {
	Verdict             string   `json:"verdict"`
	Summary             string   `json:"summary"`
	MissingRequirements []string `json:"missingRequirements"`
}

type closureReviewScopeNode struct {
	ID                  string
	Title               string
	VerifiableGoal      string
	AcceptanceCriteria  []reviewCriterionRequest
	EvidenceRequirement string
}

func uniqueTrimmedReviewCriterionIDs(values []string) []string {
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

func (s *server) reviewExecutionNode(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requireUser(w, r)
	if !ok {
		return
	}
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "不支持的请求方法")
		return
	}

	var input reviewExecutionNodeRequest
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "请求格式不正确")
		return
	}
	input.NodeID = strings.TrimSpace(input.NodeID)
	input.CompletionClaim = strings.TrimSpace(input.CompletionClaim)
	input.EvidenceText = strings.TrimSpace(input.EvidenceText)
	if input.NodeID == "" || input.CompletionClaim == "" || input.EvidenceText == "" {
		writeError(w, http.StatusBadRequest, "请提交节点编号、推进结果和逐条证据")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 70*time.Second)
	defer cancel()
	request, messagesJSON, err := s.loadNodeCompletionReviewRequest(ctx, user.ID, input)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "节点不存在")
			return
		}
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := validateReviewExecutionNodeRequest(request); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	key, err := s.loadProjectAIKey(ctx, user.ID, request.Project.ID)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusBadRequest, "请先为项目选择审查 AI")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取项目审查 AI 失败")
		return
	}

	review, err := runAIReview(ctx, key, request)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	review.AIConfig = key.snapshot()
	reviewJSON, err := jsonValue(review)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存 AI 审查失败")
		return
	}
	aiConfigJSON, err := jsonValue(review.AIConfig)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存 AI 审查配置失败")
		return
	}
	roundsJSON, err := jsonValue([]completionReviewRoundResponse{{
		ID: review.ID, Kind: "initial", Review: review, AIConfig: review.AIConfig, CreatedAt: review.CreatedAt,
	}})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存 AI 审查轮次失败")
		return
	}
	var messages []any
	_ = json.Unmarshal([]byte(messagesJSON), &messages)
	userMessageID, err := newOpaqueID("message")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存 AI 审查失败")
		return
	}
	aiMessageID, err := newOpaqueID("message")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存 AI 审查失败")
		return
	}
	messages = append(messages,
		map[string]any{"id": userMessageID, "speaker": "user", "body": input.CompletionClaim, "createdAt": time.Now()},
		map[string]any{"id": aiMessageID, "speaker": "ai", "body": review.Summary, "createdAt": review.CreatedAt},
	)
	updatedMessagesJSON, err := jsonValue(messages)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存 AI 审查失败")
		return
	}
	stage := "needs_supplement"
	if review.Verdict == "pass" {
		stage = "verified"
	}
	result, err := s.db.ExecContext(ctx, `
		UPDATE execution_contracts
		SET actor_id = ?, completion_claim = ?, evidence_text = ?, stage = ?, ai_review_json = ?, completion_review_ai_config_json = ?, completion_review_rounds_json = ?, review_messages_json = ?
		WHERE id = ? AND stage = 'frozen'`,
		user.ID, input.CompletionClaim, input.EvidenceText, stage, reviewJSON, aiConfigJSON, roundsJSON, updatedMessagesJSON, input.NodeID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存 AI 审查结果失败")
		return
	}
	updated, _ := result.RowsAffected()
	if updated == 0 {
		writeError(w, http.StatusBadRequest, "节点状态已经变化，请刷新后重试")
		return
	}
	if _, err := s.db.ExecContext(ctx, `UPDATE ai_api_keys SET last_used_at = NOW() WHERE id = ? AND user_id = ?`, key.ID, user.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "保存 AI 使用记录失败")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"review": review})
}

func (s *server) reviewExecutionNodeClarification(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requireUser(w, r)
	if !ok {
		return
	}
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "不支持的请求方法")
		return
	}

	var input reviewClarificationRequest
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "请求格式不正确")
		return
	}
	input.NodeID = strings.TrimSpace(input.NodeID)
	input.Explanation = strings.TrimSpace(input.Explanation)
	input.EvidenceReferences = strings.TrimSpace(input.EvidenceReferences)
	input.CriterionIDs = uniqueTrimmedReviewCriterionIDs(input.CriterionIDs)
	if input.NodeID == "" || len(input.CriterionIDs) == 0 || len([]rune(input.Explanation)) < 4 {
		writeError(w, http.StatusBadRequest, "请选择争议验收标准，并说明 AI 可能误解的地方")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 70*time.Second)
	defer cancel()
	request, messagesJSON, rounds, err := s.loadNodeClarificationReviewRequest(ctx, user.ID, input)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, "节点不存在")
		return
	}
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := validateReviewExecutionNodeRequest(request); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	key, err := s.loadProjectAIKey(ctx, user.ID, request.Project.ID)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusBadRequest, "请先为项目选择审查 AI")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取项目审查 AI 失败")
		return
	}

	review, err := runAIReview(ctx, key, request)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	review.AIConfig = key.snapshot()
	reviewJSON, err := jsonValue(review)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存 AI 审查失败")
		return
	}
	aiConfigJSON, err := jsonValue(review.AIConfig)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存 AI 审查配置失败")
		return
	}
	rounds = append(rounds, completionReviewRoundResponse{
		ID: review.ID, Kind: "clarification", Clarification: request.Clarification,
		Review: review, AIConfig: review.AIConfig, CreatedAt: review.CreatedAt,
	})
	roundsJSON, err := jsonValue(rounds)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存 AI 审查轮次失败")
		return
	}
	var messages []any
	_ = json.Unmarshal([]byte(messagesJSON), &messages)
	clarificationBody := fmt.Sprintf("审查澄清（%s）：%s", strings.Join(input.CriterionIDs, "、"), input.Explanation)
	if input.EvidenceReferences != "" {
		clarificationBody += "\n证据位置：" + input.EvidenceReferences
	}
	userMessageID, err := newOpaqueID("message")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存 AI 审查失败")
		return
	}
	aiMessageID, err := newOpaqueID("message")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存 AI 审查失败")
		return
	}
	messages = append(messages,
		map[string]any{"id": userMessageID, "speaker": "user", "body": clarificationBody, "createdAt": time.Now()},
		map[string]any{"id": aiMessageID, "speaker": "ai", "body": review.Summary, "createdAt": review.CreatedAt},
	)
	updatedMessagesJSON, err := jsonValue(messages)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存 AI 审查失败")
		return
	}
	stage := "needs_supplement"
	if review.Verdict == "pass" {
		stage = "verified"
	}
	result, err := s.db.ExecContext(ctx, `
		UPDATE execution_contracts
		SET stage = ?, ai_review_json = ?, completion_review_ai_config_json = ?, completion_review_rounds_json = ?, review_messages_json = ?
		WHERE id = ? AND stage IN ('verified', 'needs_supplement')`,
		stage, reviewJSON, aiConfigJSON, roundsJSON, updatedMessagesJSON, input.NodeID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存补充审查结果失败")
		return
	}
	updated, _ := result.RowsAffected()
	if updated == 0 {
		writeError(w, http.StatusBadRequest, "节点状态已经变化，请刷新后重试")
		return
	}
	if _, err := s.db.ExecContext(ctx, `UPDATE ai_api_keys SET last_used_at = NOW() WHERE id = ? AND user_id = ?`, key.ID, user.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "保存 AI 使用记录失败")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"review": review})
}

func (s *server) loadNodeCompletionReviewRequest(ctx context.Context, userID uint64, input reviewExecutionNodeRequest) (reviewExecutionNodeRequest, string, error) {
	var request reviewExecutionNodeRequest
	var criteriaJSON, messagesJSON string
	var branchID, projectCurrentID sql.NullString
	var archivedAt sql.NullTime
	err := s.db.QueryRowContext(ctx, `
		SELECT p.id, p.title, p.description, COALESCE(p.project_rules, ''), p.current_contract_id, p.archived_at,
		       n.branch_id, n.title, n.original_intent, n.verifiable_goal,
		       n.acceptance_criteria_json, n.evidence_requirement, n.smart_contract_id,
		       n.review_messages_json, n.stage
		FROM execution_contracts n JOIN projects p ON p.id = n.project_id
		WHERE n.id = ? AND p.owner_id = ?`, input.NodeID, userID).
		Scan(&request.Project.ID, &request.Project.Title, &request.Project.Description, &request.Project.ProjectRules, &projectCurrentID, &archivedAt,
			&branchID, &request.Title, &request.OriginalIntent, &request.VerifiableGoal,
			&criteriaJSON, &request.EvidenceRequirement, &request.SmartContract.ID, &messagesJSON, new(string))
	if err != nil {
		return request, "", err
	}
	if archivedAt.Valid {
		return request, "", fmt.Errorf("项目已归档，不能提交审查")
	}
	var stage string
	if err := s.db.QueryRowContext(ctx, `SELECT stage FROM execution_contracts WHERE id = ?`, input.NodeID).Scan(&stage); err != nil {
		return request, "", err
	}
	if stage != "frozen" {
		return request, "", fmt.Errorf("当前节点不能重复提交审查")
	}
	if branchID.Valid {
		var branchCurrentID sql.NullString
		if err := s.db.QueryRowContext(ctx, `SELECT current_contract_id FROM execution_branches WHERE id = ? AND project_id = ?`, branchID.String, request.Project.ID).Scan(&branchCurrentID); err != nil || !branchCurrentID.Valid || branchCurrentID.String != input.NodeID {
			return request, "", fmt.Errorf("该节点不是当前待推进节点")
		}
	} else if !projectCurrentID.Valid || projectCurrentID.String != input.NodeID {
		return request, "", fmt.Errorf("该节点不是当前待推进节点")
	}
	if err := json.Unmarshal([]byte(criteriaJSON), &request.AcceptanceCriteria); err != nil {
		return request, "", fmt.Errorf("节点验收标准已损坏")
	}
	if err := s.db.QueryRowContext(ctx, `SELECT name, description, body FROM smart_contracts WHERE id = ?`, request.SmartContract.ID).
		Scan(&request.SmartContract.Name, &request.SmartContract.Description, &request.SmartContract.Body); err != nil {
		return request, "", fmt.Errorf("平台基础审查规则不存在")
	}
	request.NodeID = input.NodeID
	if err := s.expandCompletionReviewScope(ctx, &request); err != nil {
		return request, "", err
	}
	request.CompletionClaim = input.CompletionClaim
	request.EvidenceText = input.EvidenceText
	return request, messagesJSON, nil
}

func (s *server) loadNodeClarificationReviewRequest(ctx context.Context, userID uint64, input reviewClarificationRequest) (reviewExecutionNodeRequest, string, []completionReviewRoundResponse, error) {
	var request reviewExecutionNodeRequest
	var criteriaJSON, messagesJSON string
	var completionClaim, evidenceText, aiReviewJSON, roundsJSON, aiConfigJSON sql.NullString
	var branchID, projectCurrentID sql.NullString
	var archivedAt sql.NullTime
	var stage string
	err := s.db.QueryRowContext(ctx, `
		SELECT p.id, p.title, p.description, COALESCE(p.project_rules, ''), p.current_contract_id, p.archived_at,
		       n.branch_id, n.title, n.original_intent, n.verifiable_goal,
		       n.acceptance_criteria_json, n.evidence_requirement, n.smart_contract_id,
		       n.completion_claim, n.evidence_text, n.ai_review_json, n.completion_review_ai_config_json,
		       n.review_messages_json, n.completion_review_rounds_json, n.stage
		FROM execution_contracts n JOIN projects p ON p.id = n.project_id
		WHERE n.id = ? AND p.owner_id = ?`, input.NodeID, userID).
		Scan(&request.Project.ID, &request.Project.Title, &request.Project.Description, &request.Project.ProjectRules, &projectCurrentID, &archivedAt,
			&branchID, &request.Title, &request.OriginalIntent, &request.VerifiableGoal,
			&criteriaJSON, &request.EvidenceRequirement, &request.SmartContract.ID,
			&completionClaim, &evidenceText, &aiReviewJSON, &aiConfigJSON,
			&messagesJSON, &roundsJSON, &stage)
	if err != nil {
		return request, "", nil, err
	}
	if archivedAt.Valid {
		return request, "", nil, fmt.Errorf("项目已归档，不能补充审查")
	}
	if stage != "verified" && stage != "needs_supplement" {
		return request, "", nil, fmt.Errorf("当前节点没有可澄清的 AI 审查结果")
	}
	if branchID.Valid {
		var branchCurrentID sql.NullString
		if err := s.db.QueryRowContext(ctx, `SELECT current_contract_id FROM execution_branches WHERE id = ? AND project_id = ?`, branchID.String, request.Project.ID).Scan(&branchCurrentID); err != nil || !branchCurrentID.Valid || branchCurrentID.String != input.NodeID {
			return request, "", nil, fmt.Errorf("该节点不是当前待确认节点")
		}
	} else if !projectCurrentID.Valid || projectCurrentID.String != input.NodeID {
		return request, "", nil, fmt.Errorf("该节点不是当前待确认节点")
	}
	if err := json.Unmarshal([]byte(criteriaJSON), &request.AcceptanceCriteria); err != nil {
		return request, "", nil, fmt.Errorf("节点验收标准已损坏")
	}
	selectedCriteria := make(map[string]struct{}, len(request.AcceptanceCriteria))
	for _, criterion := range request.AcceptanceCriteria {
		selectedCriteria[criterion.ID] = struct{}{}
	}
	for _, criterionID := range input.CriterionIDs {
		if _, ok := selectedCriteria[criterionID]; !ok {
			return request, "", nil, fmt.Errorf("选择的验收标准不存在")
		}
	}
	if !completionClaim.Valid || !evidenceText.Valid || !aiReviewJSON.Valid || strings.TrimSpace(completionClaim.String) == "" || strings.TrimSpace(evidenceText.String) == "" || strings.TrimSpace(aiReviewJSON.String) == "" {
		return request, "", nil, fmt.Errorf("原始提交或 AI 审查记录不存在，不能补充审查")
	}
	request.CompletionClaim = completionClaim.String
	request.EvidenceText = evidenceText.String
	if err := json.Unmarshal([]byte(aiReviewJSON.String), &request.PriorReview); err != nil || request.PriorReview == nil {
		return request, "", nil, fmt.Errorf("上一轮 AI 审查记录已损坏")
	}
	clarificationID, err := newOpaqueID("clarification")
	if err != nil {
		return request, "", nil, fmt.Errorf("生成澄清编号失败")
	}
	request.Clarification = &reviewClarificationResponse{
		ID: clarificationID, CriterionIDs: input.CriterionIDs, Explanation: input.Explanation,
		EvidenceReferences: input.EvidenceReferences, CreatedAt: time.Now(),
	}
	if err := s.db.QueryRowContext(ctx, `SELECT name, description, body FROM smart_contracts WHERE id = ?`, request.SmartContract.ID).
		Scan(&request.SmartContract.Name, &request.SmartContract.Description, &request.SmartContract.Body); err != nil {
		return request, "", nil, fmt.Errorf("平台基础审查规则不存在")
	}
	request.NodeID = input.NodeID
	if err := s.expandCompletionReviewScope(ctx, &request); err != nil {
		return request, "", nil, err
	}

	var rounds []completionReviewRoundResponse
	if roundsJSON.Valid && strings.TrimSpace(roundsJSON.String) != "" {
		if err := json.Unmarshal([]byte(roundsJSON.String), &rounds); err != nil {
			return request, "", nil, fmt.Errorf("审查轮次记录已损坏")
		}
	}
	if len(rounds) == 0 {
		config := request.PriorReview.AIConfig
		if aiConfigJSON.Valid && strings.TrimSpace(aiConfigJSON.String) != "" {
			_ = json.Unmarshal([]byte(aiConfigJSON.String), &config)
		}
		rounds = append(rounds, completionReviewRoundResponse{
			ID: request.PriorReview.ID, Kind: "initial", Review: *request.PriorReview, AIConfig: config, CreatedAt: request.PriorReview.CreatedAt,
		})
	}
	return request, messagesJSON, rounds, nil
}

func (s *server) expandCompletionReviewScope(ctx context.Context, request *reviewExecutionNodeRequest) error {
	closureNodes, err := s.loadClosureReviewScope(ctx, request.Project.ID, request.NodeID)
	if err != nil {
		return fmt.Errorf("读取收束范围失败")
	}
	if len(closureNodes) == 0 {
		return nil
	}
	currentNode := closureReviewScopeNode{
		ID: request.NodeID, Title: request.Title, VerifiableGoal: request.VerifiableGoal,
		AcceptanceCriteria: request.AcceptanceCriteria, EvidenceRequirement: request.EvidenceRequirement,
	}
	scope := append(closureNodes, currentNode)
	criteria := make([]reviewCriterionRequest, 0)
	goals := make([]string, 0, len(scope))
	evidenceRequirements := make([]string, 0, len(scope))
	for _, node := range scope {
		goals = append(goals, fmt.Sprintf("%s：%s", node.Title, node.VerifiableGoal))
		evidenceRequirements = append(evidenceRequirements, fmt.Sprintf("%s：%s", node.Title, node.EvidenceRequirement))
		for _, criterion := range node.AcceptanceCriteria {
			criteria = append(criteria, reviewCriterionRequest{
				ID: fmt.Sprintf("%s::%s", node.ID, criterion.ID), Text: fmt.Sprintf("[%s] %s", node.Title, criterion.Text), RequiredEvidence: criterion.RequiredEvidence,
			})
		}
	}
	request.Title = fmt.Sprintf("收束推进：%s", currentNode.Title)
	request.OriginalIntent = "这次提交会收束此前未闭合的推进节点与当前补齐节点；必须逐项核验整个收束范围。"
	request.VerifiableGoal = strings.Join(goals, "\n")
	request.AcceptanceCriteria = criteria
	request.EvidenceRequirement = strings.Join(evidenceRequirements, "\n")
	return nil
}

func (s *server) loadClosureReviewScope(ctx context.Context, projectID, targetNodeID string) ([]closureReviewScopeNode, error) {
	queue := []string{targetNodeID}
	visited := map[string]struct{}{targetNodeID: {}}
	scope := make([]closureReviewScopeNode, 0)
	for len(queue) > 0 {
		targetID := queue[0]
		queue = queue[1:]
		rows, err := s.db.QueryContext(ctx, `
			SELECT source_contract_id FROM execution_edges
			WHERE target_contract_id = ? AND type = 'closure'`, targetID)
		if err != nil {
			return nil, err
		}
		for rows.Next() {
			var sourceID string
			if err := rows.Scan(&sourceID); err != nil {
				rows.Close()
				return nil, err
			}
			if _, seen := visited[sourceID]; seen {
				continue
			}
			visited[sourceID] = struct{}{}
			var node closureReviewScopeNode
			var criteriaJSON string
			if err := s.db.QueryRowContext(ctx, `
				SELECT id, title, verifiable_goal, acceptance_criteria_json, evidence_requirement
				FROM execution_contracts WHERE id = ? AND project_id = ?`, sourceID, projectID).
				Scan(&node.ID, &node.Title, &node.VerifiableGoal, &criteriaJSON, &node.EvidenceRequirement); err != nil {
				rows.Close()
				return nil, err
			}
			if err := json.Unmarshal([]byte(criteriaJSON), &node.AcceptanceCriteria); err != nil {
				rows.Close()
				return nil, err
			}
			scope = append(scope, node)
			queue = append(queue, sourceID)
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			return nil, err
		}
		rows.Close()
	}
	return scope, nil
}

func (s *server) reviewNodeDraft(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requireUser(w, r)
	if !ok {
		return
	}
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "不支持的请求方法")
		return
	}

	var request reviewNodeDraftRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "请求格式不正确")
		return
	}
	if err := validateReviewNodeDraftRequest(request); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 70*time.Second)
	defer cancel()
	key, err := s.loadProjectAIKey(ctx, user.ID, request.Project.ID)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusBadRequest, "请先为项目选择审查 AI")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取项目审查 AI 失败")
		return
	}

	review, err := runNodeDraftReview(ctx, key, request)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	review.AIConfig = key.snapshot()
	if _, err := s.db.ExecContext(ctx, `UPDATE ai_api_keys SET last_used_at = NOW() WHERE id = ? AND user_id = ?`, key.ID, user.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "保存 AI 使用记录失败")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"review": review})
}

func validateReviewExecutionNodeRequest(request reviewExecutionNodeRequest) error {
	if strings.TrimSpace(request.Title) == "" || strings.TrimSpace(request.VerifiableGoal) == "" {
		return fmt.Errorf("节点目标不完整，无法审查")
	}
	if len(request.AcceptanceCriteria) == 0 {
		return fmt.Errorf("节点没有验收标准，无法审查")
	}
	if strings.TrimSpace(request.CompletionClaim) == "" || strings.TrimSpace(request.EvidenceText) == "" {
		return fmt.Errorf("请提交推进结果和逐条证据")
	}
	if strings.TrimSpace(request.SmartContract.Body) == "" {
		return fmt.Errorf("平台基础审查规则为空，无法审查")
	}
	for _, criterion := range request.AcceptanceCriteria {
		if strings.TrimSpace(criterion.ID) == "" || strings.TrimSpace(criterion.Text) == "" {
			return fmt.Errorf("验收标准不完整，无法审查")
		}
	}
	return nil
}

func validateReviewNodeDraftRequest(request reviewNodeDraftRequest) error {
	if strings.TrimSpace(request.Title) == "" || strings.TrimSpace(request.VerifiableGoal) == "" {
		return fmt.Errorf("请先填写节点标题和可验证目标")
	}
	if len(request.AcceptanceCriteria) == 0 {
		return fmt.Errorf("请至少填写一条验收标准")
	}
	if strings.TrimSpace(request.EvidenceRequirement) == "" {
		return fmt.Errorf("请填写证据要求")
	}
	if strings.TrimSpace(request.Draft) == "" {
		return fmt.Errorf("节点草案为空，无法审查")
	}
	if strings.TrimSpace(request.SmartContract.Body) == "" {
		return fmt.Errorf("平台基础审查规则为空，无法审查")
	}
	for _, criterion := range request.AcceptanceCriteria {
		if strings.TrimSpace(criterion) == "" {
			return fmt.Errorf("验收标准不能为空")
		}
	}
	return nil
}

func (s *server) loadProjectAIKey(ctx context.Context, userID uint64, projectID string) (aiStoredKey, error) {
	var key aiStoredKey
	err := s.db.QueryRowContext(ctx, `
		SELECT k.id, k.provider, k.label, k.key_ciphertext, k.base_url, k.model
		FROM projects p JOIN ai_api_keys k ON k.id = p.default_ai_key_id
		WHERE p.id = ? AND p.owner_id = ?`, projectID, userID).
		Scan(&key.ID, &key.Provider, &key.Label, &key.APIKey, &key.BaseURL, &key.Model)
	return key, err
}

func (s *server) loadProjectAIConfig(ctx context.Context, userID uint64, projectID string) (aiConfigSnapshot, error) {
	key, err := s.loadProjectAIKey(ctx, userID, projectID)
	if err != nil {
		return aiConfigSnapshot{}, err
	}
	return key.snapshot(), nil
}

func runAIReview(ctx context.Context, key aiStoredKey, request reviewExecutionNodeRequest) (aiReviewResponse, error) {
	modelOutput, err := requestAIReviewFromModel(ctx, key, request)
	if err != nil {
		return aiReviewResponse{}, err
	}
	reviewID, err := newOpaqueID("review")
	if err != nil {
		return aiReviewResponse{}, fmt.Errorf("生成审查编号失败")
	}
	return normalizeAIReviewOutput(reviewID, time.Now(), request, modelOutput), nil
}

func runNodeDraftReview(ctx context.Context, key aiStoredKey, request reviewNodeDraftRequest) (nodeDraftReviewResponse, error) {
	modelOutput, err := requestNodeDraftReviewFromModel(ctx, key, request)
	if err != nil {
		return nodeDraftReviewResponse{}, err
	}
	reviewID, err := newOpaqueID("draft-review")
	if err != nil {
		return nodeDraftReviewResponse{}, fmt.Errorf("生成节点草案审核编号失败")
	}
	return normalizeNodeDraftReviewOutput(reviewID, time.Now(), modelOutput), nil
}

func requestAIReviewFromModel(ctx context.Context, key aiStoredKey, reviewRequest reviewExecutionNodeRequest) (aiReviewModelOutput, error) {
	request, err := newAIReviewRequest(ctx, key, reviewRequest)
	if err != nil {
		return aiReviewModelOutput{}, fmt.Errorf("AI 审查请求生成失败")
	}
	response, err := (&http.Client{Timeout: 65 * time.Second}).Do(request)
	if err != nil {
		return aiReviewModelOutput{}, fmt.Errorf("无法连接 AI 服务，请检查默认密钥、模型和网络")
	}
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, 2<<20))
	if err != nil {
		return aiReviewModelOutput{}, fmt.Errorf("读取 AI 审查结果失败")
	}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return aiReviewModelOutput{}, fmt.Errorf("AI 审查失败：服务商返回 HTTP %d", response.StatusCode)
	}
	content, err := extractAIMessageContent(key.Provider, body)
	if err != nil {
		return aiReviewModelOutput{}, err
	}
	var output aiReviewModelOutput
	if err := json.Unmarshal([]byte(extractJSONObject(content)), &output); err != nil {
		return aiReviewModelOutput{}, fmt.Errorf("AI 审查结果不是可解析的 JSON")
	}
	return output, nil
}

func requestNodeDraftReviewFromModel(ctx context.Context, key aiStoredKey, reviewRequest reviewNodeDraftRequest) (nodeDraftReviewModelOutput, error) {
	request, err := newNodeDraftReviewRequest(ctx, key, reviewRequest)
	if err != nil {
		return nodeDraftReviewModelOutput{}, fmt.Errorf("节点草案审核请求生成失败")
	}
	response, err := (&http.Client{Timeout: 65 * time.Second}).Do(request)
	if err != nil {
		return nodeDraftReviewModelOutput{}, fmt.Errorf("无法连接 AI 服务，请检查默认密钥、模型和网络")
	}
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, 2<<20))
	if err != nil {
		return nodeDraftReviewModelOutput{}, fmt.Errorf("读取节点草案审核结果失败")
	}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return nodeDraftReviewModelOutput{}, fmt.Errorf("节点草案审核失败：服务商返回 HTTP %d", response.StatusCode)
	}
	content, err := extractAIMessageContent(key.Provider, body)
	if err != nil {
		return nodeDraftReviewModelOutput{}, err
	}
	var output nodeDraftReviewModelOutput
	if err := json.Unmarshal([]byte(extractJSONObject(content)), &output); err != nil {
		return nodeDraftReviewModelOutput{}, fmt.Errorf("节点草案审核结果不是可解析的 JSON")
	}
	return output, nil
}

func newAIReviewRequest(ctx context.Context, key aiStoredKey, reviewRequest reviewExecutionNodeRequest) (*http.Request, error) {
	definition, ok := aiProviderDefinitions[key.Provider]
	if !ok {
		return nil, fmt.Errorf("unsupported provider")
	}
	systemPrompt := strings.Join([]string{
		"你是 Exec Graph 的智能合约审查器。",
		"你的任务是根据项目规则、当前行动契约、验收标准、证据要求、用户完成说明和用户证据，判断这次推进是否足以锁定。",
		"不要因为用户态度积极就放宽标准。不要引入冻结规则之外的新要求。",
		"若附有审查澄清：原始完成说明和原始证据仍然是唯一可判定的提交；澄清只能帮助定位或解释其中已经存在的内容，不能视为新完成的工作或新增证据。",
		"只返回 JSON，不要 Markdown，不要额外解释。",
	}, "\n")
	userPromptBytes, err := json.MarshalIndent(map[string]any{
		"project":              reviewRequest.Project,
		"smartContract":        reviewRequest.SmartContract,
		"node":                 map[string]any{"id": reviewRequest.NodeID, "title": reviewRequest.Title, "originalIntent": reviewRequest.OriginalIntent, "verifiableGoal": reviewRequest.VerifiableGoal},
		"acceptanceCriteria":   reviewRequest.AcceptanceCriteria,
		"evidenceRequirement":  reviewRequest.EvidenceRequirement,
		"completionClaim":      reviewRequest.CompletionClaim,
		"evidenceText":         reviewRequest.EvidenceText,
		"priorReview":          reviewRequest.PriorReview,
		"clarification":        reviewRequest.Clarification,
		"requiredJSONResponse": map[string]any{"verdict": "pass|partial|fail", "summary": "中文审查摘要", "criterionReviews": []map[string]string{{"criterionId": "必须对应验收标准 id", "result": "met|unclear|unmet", "reason": "中文理由"}}, "suggestedSupplementTitle": "未完全通过时给出下一步补足节点标题；通过时为空字符串"},
	}, "", "  ")
	if err != nil {
		return nil, err
	}
	userPrompt := string(userPromptBytes)

	var endpoint string
	var payload any
	if definition.AuthStyle == "anthropic" {
		endpoint = strings.TrimRight(key.BaseURL, "/") + "/messages"
		payload = map[string]any{
			"model":       key.Model,
			"max_tokens":  4096,
			"temperature": 0,
			"system":      systemPrompt,
			"messages": []map[string]string{
				{"role": "user", "content": userPrompt},
			},
		}
	} else {
		endpoint = strings.TrimRight(key.BaseURL, "/") + "/chat/completions"
		payload = map[string]any{
			"model":       key.Model,
			"max_tokens":  4096,
			"temperature": 0,
			"messages": []map[string]string{
				{"role": "system", "content": systemPrompt},
				{"role": "user", "content": userPrompt},
			},
			"response_format": map[string]string{"type": "json_object"},
		}
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	httpRequest, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpRequest.Header.Set("Content-Type", "application/json")
	if definition.AuthStyle == "anthropic" {
		httpRequest.Header.Set("x-api-key", key.APIKey)
		httpRequest.Header.Set("anthropic-version", "2023-06-01")
		return httpRequest, nil
	}
	httpRequest.Header.Set("Authorization", "Bearer "+key.APIKey)
	return httpRequest, nil
}

func newNodeDraftReviewRequest(ctx context.Context, key aiStoredKey, reviewRequest reviewNodeDraftRequest) (*http.Request, error) {
	definition, ok := aiProviderDefinitions[key.Provider]
	if !ok {
		return nil, fmt.Errorf("unsupported provider")
	}
	systemPrompt := strings.Join([]string{
		"你是 Exec Graph 的推进节点草案审查器。",
		"你的任务是判断用户准备创建的节点草案是否足够清晰，且是否符合项目规则，能否被冻结为一次真实推进的行动契约。",
		"只审查节点创建内容：标题、可验证目标、验收标准和证据要求。不要审查用户是否已经完成任务。",
		"通过标准：读者能理解这次推进要完成什么，AI 将来能依据冻结标准审查提交结果。",
		"不通过时给出具体缺口。只返回 JSON，不要 Markdown，不要额外解释。",
	}, "\n")
	userPromptBytes, err := json.MarshalIndent(map[string]any{
		"project":       reviewRequest.Project,
		"smartContract": reviewRequest.SmartContract,
		"nodeDraft": map[string]any{
			"title":               reviewRequest.Title,
			"verifiableGoal":      reviewRequest.VerifiableGoal,
			"acceptanceCriteria":  reviewRequest.AcceptanceCriteria,
			"evidenceRequirement": reviewRequest.EvidenceRequirement,
			"rawDraft":            reviewRequest.Draft,
		},
		"requiredJSONResponse": map[string]any{
			"verdict":             "pass|fail",
			"summary":             "中文审核摘要",
			"missingRequirements": []string{"不通过时列出需要补充的具体内容；通过时返回空数组"},
		},
	}, "", "  ")
	if err != nil {
		return nil, err
	}
	userPrompt := string(userPromptBytes)

	var endpoint string
	var payload any
	if definition.AuthStyle == "anthropic" {
		endpoint = strings.TrimRight(key.BaseURL, "/") + "/messages"
		payload = map[string]any{
			"model":       key.Model,
			"max_tokens":  900,
			"temperature": 0,
			"system":      systemPrompt,
			"messages": []map[string]string{
				{"role": "user", "content": userPrompt},
			},
		}
	} else {
		endpoint = strings.TrimRight(key.BaseURL, "/") + "/chat/completions"
		payload = map[string]any{
			"model":       key.Model,
			"max_tokens":  900,
			"temperature": 0,
			"messages": []map[string]string{
				{"role": "system", "content": systemPrompt},
				{"role": "user", "content": userPrompt},
			},
			"response_format": map[string]string{"type": "json_object"},
		}
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	httpRequest, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpRequest.Header.Set("Content-Type", "application/json")
	if definition.AuthStyle == "anthropic" {
		httpRequest.Header.Set("x-api-key", key.APIKey)
		httpRequest.Header.Set("anthropic-version", "2023-06-01")
		return httpRequest, nil
	}
	httpRequest.Header.Set("Authorization", "Bearer "+key.APIKey)
	return httpRequest, nil
}

func extractAIMessageContent(provider string, body []byte) (string, error) {
	definition, ok := aiProviderDefinitions[provider]
	if !ok {
		return "", fmt.Errorf("AI 服务不支持")
	}
	if definition.AuthStyle == "anthropic" {
		var decoded struct {
			Content []struct {
				Text string `json:"text"`
			} `json:"content"`
		}
		if err := json.Unmarshal(body, &decoded); err != nil {
			return "", fmt.Errorf("AI 审查结果格式不正确")
		}
		for _, item := range decoded.Content {
			if strings.TrimSpace(item.Text) != "" {
				return item.Text, nil
			}
		}
		return "", fmt.Errorf("AI 审查没有返回文本")
	}
	var decoded struct {
		Choices []struct {
			Message struct {
				Content          json.RawMessage `json:"content"`
				ReasoningContent string          `json:"reasoning_content"`
				Refusal          string          `json:"refusal"`
			} `json:"message"`
			FinishReason string `json:"finish_reason"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(body, &decoded); err != nil {
		return "", fmt.Errorf("AI 审查结果格式不正确")
	}
	if len(decoded.Choices) == 0 {
		return "", fmt.Errorf("AI 审查没有返回候选结果")
	}
	choice := decoded.Choices[0]
	content := extractOpenAIContent(choice.Message.Content)
	if content != "" {
		return content, nil
	}
	if strings.TrimSpace(choice.Message.Refusal) != "" {
		return "", fmt.Errorf("AI 拒绝生成审查结论：%s", strings.TrimSpace(choice.Message.Refusal))
	}
	if strings.TrimSpace(choice.Message.ReasoningContent) != "" {
		return "", fmt.Errorf("AI 只返回了推理过程，未生成最终审查结论。请重试；若持续发生，请在 AI 密钥设置中改用可直接输出结果的模型，例如 deepseek-chat")
	}
	if choice.FinishReason == "length" {
		return "", fmt.Errorf("AI 在生成最终审查结论前达到输出上限，请重试或改用输出更直接的模型")
	}
	return "", fmt.Errorf("AI 审查没有返回最终结论")
}

func extractOpenAIContent(raw json.RawMessage) string {
	if len(raw) == 0 || string(raw) == "null" {
		return ""
	}
	var text string
	if err := json.Unmarshal(raw, &text); err == nil {
		return strings.TrimSpace(text)
	}
	var parts []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	}
	if err := json.Unmarshal(raw, &parts); err != nil {
		return ""
	}
	values := make([]string, 0, len(parts))
	for _, part := range parts {
		if strings.TrimSpace(part.Text) != "" {
			values = append(values, strings.TrimSpace(part.Text))
		}
	}
	return strings.Join(values, "\n")
}

func extractJSONObject(value string) string {
	trimmed := strings.TrimSpace(value)
	trimmed = strings.TrimPrefix(trimmed, "```json")
	trimmed = strings.TrimPrefix(trimmed, "```")
	trimmed = strings.TrimSuffix(trimmed, "```")
	trimmed = strings.TrimSpace(trimmed)
	start := strings.Index(trimmed, "{")
	end := strings.LastIndex(trimmed, "}")
	if start >= 0 && end > start {
		return trimmed[start : end+1]
	}
	return trimmed
}

func normalizeNodeDraftReviewOutput(id string, createdAt time.Time, output nodeDraftReviewModelOutput) nodeDraftReviewResponse {
	verdict := strings.TrimSpace(output.Verdict)
	if verdict != "pass" && verdict != "fail" {
		verdict = "fail"
	}
	missingRequirements := make([]string, 0, len(output.MissingRequirements))
	for _, requirement := range output.MissingRequirements {
		if trimmed := strings.TrimSpace(requirement); trimmed != "" {
			missingRequirements = append(missingRequirements, trimmed)
		}
	}
	if verdict == "fail" && len(missingRequirements) == 0 {
		missingRequirements = append(missingRequirements, "请补充可验证目标、验收标准或证据要求。")
	}
	if verdict == "pass" {
		missingRequirements = []string{}
	}
	summary := strings.TrimSpace(output.Summary)
	if summary == "" {
		if verdict == "pass" {
			summary = "节点草案审核通过。这个推进节点符合项目规则，可以冻结。"
		} else {
			summary = "节点草案审核未通过。当前描述还不足以支撑后续完成审查。"
		}
	}
	return nodeDraftReviewResponse{
		ID:                  id,
		Verdict:             verdict,
		Summary:             summary,
		MissingRequirements: missingRequirements,
		CreatedAt:           createdAt,
	}
}

func normalizeAIReviewOutput(id string, createdAt time.Time, request reviewExecutionNodeRequest, output aiReviewModelOutput) aiReviewResponse {
	validResults := map[string]bool{"met": true, "unclear": true, "unmet": true}
	reviewsByCriterion := make(map[string]criterionReviewResponse, len(output.CriterionReviews))
	for _, review := range output.CriterionReviews {
		criterionID := strings.TrimSpace(review.CriterionID)
		result := strings.TrimSpace(review.Result)
		if !validResults[result] {
			result = "unclear"
		}
		reason := strings.TrimSpace(review.Reason)
		if reason == "" {
			reason = "AI 没有给出明确理由，暂按证据不足处理。"
		}
		if criterionID != "" {
			reviewsByCriterion[criterionID] = criterionReviewResponse{CriterionID: criterionID, Result: result, Reason: reason}
		}
	}

	criterionReviews := make([]criterionReviewResponse, 0, len(request.AcceptanceCriteria))
	metCount := 0
	for _, criterion := range request.AcceptanceCriteria {
		review, ok := reviewsByCriterion[criterion.ID]
		if !ok {
			review = criterionReviewResponse{CriterionID: criterion.ID, Result: "unclear", Reason: "AI 没有覆盖这条验收标准，暂按证据不足处理。"}
		}
		if review.Result == "met" {
			metCount++
		}
		criterionReviews = append(criterionReviews, review)
	}

	verdict := strings.TrimSpace(output.Verdict)
	if verdict != "pass" && verdict != "partial" && verdict != "fail" {
		switch {
		case metCount == len(request.AcceptanceCriteria):
			verdict = "pass"
		case metCount > 0:
			verdict = "partial"
		default:
			verdict = "fail"
		}
	}
	if verdict == "pass" {
		for _, review := range criterionReviews {
			if review.Result != "met" {
				verdict = "partial"
				break
			}
		}
	}

	summary := strings.TrimSpace(output.Summary)
	if summary == "" {
		if verdict == "pass" {
			summary = "智能合约审查通过。这次推进满足冻结验收标准，等待用户确认后锁定。"
		} else {
			summary = "智能合约审查未通过。当前证据仍有缺口，可以继续补足或带着该结论锁定。"
		}
	}
	supplementTitle := strings.TrimSpace(output.SuggestedSupplementTitle)
	if verdict != "pass" && supplementTitle == "" {
		supplementTitle = fmt.Sprintf("补齐「%s」", firstUnmetCriterionTitle(request.AcceptanceCriteria, criterionReviews, request.Title))
	}
	if verdict == "pass" {
		supplementTitle = ""
	}

	return aiReviewResponse{
		ID:                       id,
		Verdict:                  verdict,
		Summary:                  summary,
		CriterionReviews:         criterionReviews,
		SuggestedSupplementTitle: supplementTitle,
		CreatedAt:                createdAt,
	}
}

func firstUnmetCriterionTitle(criteria []reviewCriterionRequest, reviews []criterionReviewResponse, fallback string) string {
	for _, review := range reviews {
		if review.Result == "met" {
			continue
		}
		for _, criterion := range criteria {
			if criterion.ID == review.CriterionID && strings.TrimSpace(criterion.Text) != "" {
				return criterion.Text
			}
		}
	}
	return fallback
}
