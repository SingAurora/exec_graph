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

type actionDraft struct {
	Title               string   `json:"title"`
	VerifiableGoal      string   `json:"verifiableGoal"`
	AcceptanceCriteria  []string `json:"acceptanceCriteria"`
	EvidenceRequirement string   `json:"evidenceRequirement"`
}

type conversationMessageResponse struct {
	ID                string            `json:"id"`
	Role              string            `json:"role"`
	Body              string            `json:"body"`
	StructuredPayload any               `json:"structuredPayload,omitempty"`
	AIConfig          *aiConfigSnapshot `json:"aiConfig,omitempty"`
	CreatedAt         time.Time         `json:"createdAt"`
}

type conversationResponse struct {
	ID           string                        `json:"id"`
	ProjectID    string                        `json:"projectId"`
	NodeID       *string                       `json:"nodeId,omitempty"`
	Phase        string                        `json:"phase"`
	Status       string                        `json:"status"`
	Context      any                           `json:"context"`
	CurrentDraft *actionDraft                  `json:"currentDraft,omitempty"`
	LatestReview any                           `json:"latestReview,omitempty"`
	AIConfig     *aiConfigSnapshot             `json:"aiConfig,omitempty"`
	Messages     []conversationMessageResponse `json:"messages"`
	CreatedAt    time.Time                     `json:"createdAt"`
	UpdatedAt    time.Time                     `json:"updatedAt"`
}

type createConversationRequest struct {
	ParentContractID  string   `json:"parentContractId"`
	SourceContractIDs []string `json:"sourceContractIds"`
	BranchID          string   `json:"branchId"`
	Fork              bool     `json:"fork"`
	ClosureSourceIDs  []string `json:"closureSourceIds"`
}

type sendConversationMessageRequest struct {
	Body string `json:"body"`
}

type planningConversationOutput struct {
	Reply          string      `json:"reply"`
	Draft          actionDraft `json:"draft"`
	ReadyForFreeze bool        `json:"readyForFreezeReview"`
}

type completionConversationOutput struct {
	Reply              string              `json:"reply"`
	Review             aiReviewModelOutput `json:"review"`
	RequiresSupplement bool                `json:"requiresSupplement"`
}

func (s *server) handleConversations(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requireUser(w, r)
	if !ok {
		return
	}
	parts := strings.Split(strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/conversations"), "/"), "/")
	if len(parts) == 0 || parts[0] == "" {
		writeError(w, http.StatusNotFound, "对话不存在")
		return
	}
	conversationID := parts[0]
	if len(parts) == 1 && r.Method == http.MethodGet {
		s.getConversation(w, r, user.ID, conversationID)
		return
	}
	if len(parts) == 2 && parts[1] == "messages" && r.Method == http.MethodPost {
		s.sendConversationMessage(w, r, user.ID, conversationID, false)
		return
	}
	if len(parts) == 2 && parts[1] == "freeze-review" && r.Method == http.MethodPost {
		s.sendConversationMessage(w, r, user.ID, conversationID, true)
		return
	}
	writeError(w, http.StatusNotFound, "对话接口不存在")
}

func (s *server) createPlanningConversation(w http.ResponseWriter, r *http.Request, userID uint64, projectID string) {
	var input createConversationRequest
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "请求格式不正确")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	if _, err := s.loadProjectAIKey(ctx, userID, projectID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusBadRequest, "请先为项目选择审查 AI")
			return
		}
		writeError(w, http.StatusInternalServerError, "读取项目审查 AI 失败")
		return
	}
	var title, description, rules string
	var archived sql.NullTime
	if err := s.db.QueryRowContext(ctx, `SELECT title, description, COALESCE(project_rules, ''), archived_at FROM projects WHERE id = ? AND owner_id = ?`, projectID, userID).Scan(&title, &description, &rules, &archived); err != nil {
		writeError(w, http.StatusNotFound, "项目不存在")
		return
	}
	if archived.Valid {
		writeError(w, http.StatusBadRequest, "项目已归档，不能创建推进")
		return
	}
	contextJSON, _ := jsonValue(map[string]any{"project": map[string]string{"title": title, "description": description, "rules": rules}, "relation": input})
	var existing string
	err := s.db.QueryRowContext(ctx, `SELECT id FROM node_conversations WHERE project_id = ? AND owner_id = ? AND phase = 'planning' AND status IN ('active', 'ready_for_freeze') AND context_json = ? ORDER BY updated_at DESC LIMIT 1`, projectID, userID, contextJSON).Scan(&existing)
	if err == nil {
		s.getConversation(w, r, userID, existing)
		return
	}
	if !errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusInternalServerError, "读取目标对话失败")
		return
	}
	id, err := newOpaqueID("conversation")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "创建对话失败")
		return
	}
	if _, err := s.db.ExecContext(ctx, `INSERT INTO node_conversations (id, project_id, owner_id, phase, status, context_json) VALUES (?, ?, ?, 'planning', 'active', ?)`, id, projectID, userID, contextJSON); err != nil {
		writeError(w, http.StatusInternalServerError, "创建对话失败")
		return
	}
	s.getConversation(w, r, userID, id)
}

func (s *server) createCompletionConversation(w http.ResponseWriter, r *http.Request, userID uint64, projectID, nodeID string) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	var existing string
	err := s.db.QueryRowContext(ctx, `SELECT id FROM node_conversations WHERE project_id = ? AND node_id = ? AND owner_id = ? AND phase = 'completion' AND status = 'active' ORDER BY updated_at DESC LIMIT 1`, projectID, nodeID, userID).Scan(&existing)
	if err == nil {
		s.getConversation(w, r, userID, existing)
		return
	}
	if !errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusInternalServerError, "读取审查对话失败")
		return
	}
	key, err := s.loadProjectAIKey(ctx, userID, projectID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "请先为项目选择审查 AI")
		return
	}
	var title, goal, evidence, criteriaJSON, projectTitle, projectDescription, rules string
	var stage string
	err = s.db.QueryRowContext(ctx, `SELECT n.title, n.verifiable_goal, n.evidence_requirement, n.acceptance_criteria_json, n.stage, p.title, p.description, COALESCE(p.project_rules, '') FROM execution_contracts n JOIN projects p ON p.id = n.project_id WHERE n.id = ? AND n.project_id = ? AND p.owner_id = ?`, nodeID, projectID, userID).Scan(&title, &goal, &evidence, &criteriaJSON, &stage, &projectTitle, &projectDescription, &rules)
	if err != nil {
		writeError(w, http.StatusNotFound, "节点不存在")
		return
	}
	if stage == "completed" || stage == "sealed" {
		writeError(w, http.StatusBadRequest, "节点已锁定，不能继续审查")
		return
	}
	contextJSON, _ := jsonValue(map[string]any{"project": map[string]string{"title": projectTitle, "description": projectDescription, "rules": rules}, "node": map[string]any{"title": title, "verifiableGoal": goal, "acceptanceCriteria": json.RawMessage(criteriaJSON), "evidenceRequirement": evidence}})
	id, err := newOpaqueID("conversation")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "创建审查对话失败")
		return
	}
	configJSON, _ := jsonValue(key.snapshot())
	if _, err := s.db.ExecContext(ctx, `INSERT INTO node_conversations (id, project_id, node_id, owner_id, phase, status, context_json, ai_config_json) VALUES (?, ?, ?, ?, 'completion', 'active', ?, ?)`, id, projectID, nodeID, userID, contextJSON, configJSON); err != nil {
		writeError(w, http.StatusInternalServerError, "创建审查对话失败")
		return
	}
	if _, err := s.db.ExecContext(ctx, `UPDATE execution_contracts SET completion_conversation_id = ? WHERE id = ?`, id, nodeID); err != nil {
		writeError(w, http.StatusInternalServerError, "关联审查对话失败")
		return
	}
	s.getConversation(w, r, userID, id)
}

func (s *server) getConversation(w http.ResponseWriter, r *http.Request, userID uint64, id string) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	conversation, err := s.loadConversation(ctx, userID, id)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, "对话不存在")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取对话失败")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"conversation": conversation})
}

func (s *server) loadConversation(ctx context.Context, userID uint64, id string) (conversationResponse, error) {
	var result conversationResponse
	var nodeID, draft, review, config sql.NullString
	var contextJSON string
	err := s.db.QueryRowContext(ctx, `SELECT id, project_id, node_id, phase, status, context_json, current_draft_json, latest_review_json, ai_config_json, created_at, updated_at FROM node_conversations WHERE id = ? AND owner_id = ?`, id, userID).Scan(&result.ID, &result.ProjectID, &nodeID, &result.Phase, &result.Status, &contextJSON, &draft, &review, &config, &result.CreatedAt, &result.UpdatedAt)
	if err != nil {
		return result, err
	}
	result.NodeID = nullableString(nodeID)
	result.Context = decodeJSONValue(contextJSON, map[string]any{})
	if draft.Valid {
		var value actionDraft
		if json.Unmarshal([]byte(draft.String), &value) == nil {
			result.CurrentDraft = &value
		}
	}
	if review.Valid {
		result.LatestReview = decodeJSONValue(review.String, nil)
	}
	if config.Valid {
		var value aiConfigSnapshot
		if json.Unmarshal([]byte(config.String), &value) == nil {
			result.AIConfig = &value
		}
	}
	rows, err := s.db.QueryContext(ctx, `SELECT id, role, body, structured_payload_json, ai_config_json, created_at FROM node_conversation_messages WHERE conversation_id = ? ORDER BY created_at ASC, id ASC`, id)
	if err != nil {
		return result, err
	}
	defer rows.Close()
	result.Messages = []conversationMessageResponse{}
	for rows.Next() {
		var item conversationMessageResponse
		var payload, messageConfig sql.NullString
		if err := rows.Scan(&item.ID, &item.Role, &item.Body, &payload, &messageConfig, &item.CreatedAt); err != nil {
			return result, err
		}
		if payload.Valid {
			item.StructuredPayload = decodeJSONValue(payload.String, nil)
		}
		if messageConfig.Valid {
			var value aiConfigSnapshot
			if json.Unmarshal([]byte(messageConfig.String), &value) == nil {
				item.AIConfig = &value
			}
		}
		result.Messages = append(result.Messages, item)
	}
	return result, rows.Err()
}

func (s *server) sendConversationMessage(w http.ResponseWriter, r *http.Request, userID uint64, conversationID string, freezeReview bool) {
	var input sendConversationMessageRequest
	if !freezeReview {
		if err := decodeJSON(r, &input); err != nil {
			writeError(w, http.StatusBadRequest, "请求格式不正确")
			return
		}
		input.Body = strings.TrimSpace(input.Body)
		if input.Body == "" {
			writeError(w, http.StatusBadRequest, "请输入要发送的内容")
			return
		}
	} else {
		input.Body = "请基于当前对话和草案进行冻结审核；只在全部字段清晰、可验证且证据要求充分时允许冻结。"
	}
	ctx, cancel := context.WithTimeout(r.Context(), 85*time.Second)
	defer cancel()
	conversation, err := s.loadConversation(ctx, userID, conversationID)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, "对话不存在")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取对话失败")
		return
	}
	if conversation.Status == "frozen" || conversation.Status == "closed" {
		writeError(w, http.StatusBadRequest, "对话已结束")
		return
	}
	key, err := s.loadProjectAIKey(ctx, userID, conversation.ProjectID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "项目审查 AI 不可用")
		return
	}
	userMessageID, err := newOpaqueID("message")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存消息失败")
		return
	}
	if _, err := s.db.ExecContext(ctx, `INSERT INTO node_conversation_messages (id, conversation_id, role, body) VALUES (?, ?, 'user', ?)`, userMessageID, conversationID, input.Body); err != nil {
		writeError(w, http.StatusInternalServerError, "保存消息失败")
		return
	}
	conversation.Messages = append(conversation.Messages, conversationMessageResponse{ID: userMessageID, Role: "user", Body: input.Body, CreatedAt: time.Now()})
	if conversation.Phase == "planning" {
		output, err := requestPlanningConversation(ctx, key, conversation, freezeReview)
		if err != nil {
			writeError(w, http.StatusBadGateway, err.Error())
			return
		}
		if strings.TrimSpace(output.Reply) == "" {
			output.Reply = "我已更新行动契约草案，请检查右侧内容。"
		}
		draftJSON, _ := jsonValue(output.Draft)
		payloadJSON, _ := jsonValue(output)
		status := "active"
		if output.ReadyForFreeze {
			status = "ready_for_freeze"
		}
		if err := s.persistAssistantConversationMessage(ctx, conversationID, output.Reply, payloadJSON, key.snapshot()); err != nil {
			writeError(w, http.StatusInternalServerError, "保存 AI 回复失败")
			return
		}
		if _, err := s.db.ExecContext(ctx, `UPDATE node_conversations SET status = ?, current_draft_json = ?, ai_config_json = ? WHERE id = ?`, status, draftJSON, mustJSON(key.snapshot()), conversationID); err != nil {
			writeError(w, http.StatusInternalServerError, "保存对话状态失败")
			return
		}
	} else {
		output, err := requestCompletionConversation(ctx, key, conversation)
		if err != nil {
			writeError(w, http.StatusBadGateway, err.Error())
			return
		}
		if strings.TrimSpace(output.Reply) == "" {
			output.Reply = output.Review.Summary
		}
		reviewID, err := newOpaqueID("review")
		if err != nil {
			writeError(w, http.StatusInternalServerError, "生成审查编号失败")
			return
		}
		review := normalizeAIReviewOutput(reviewID, time.Now(), reviewRequestFromConversation(conversation), output.Review)
		review.AIConfig = key.snapshot()
		reviewJSON, _ := jsonValue(review)
		stage := "needs_supplement"
		if review.Verdict == "pass" {
			stage = "verified"
		}
		if err := s.persistCompletionReview(ctx, userID, conversation, conversationID, input.Body, output, reviewJSON, key.snapshot(), stage); err != nil {
			if errors.Is(err, errConversationNoLongerMutable) {
				writeError(w, http.StatusConflict, "节点已锁定或审查对话已结束，本轮 AI 结果未写入")
				return
			}
			writeError(w, http.StatusInternalServerError, "保存审查结果失败")
			return
		}
	}
	_, _ = s.db.ExecContext(ctx, `UPDATE ai_api_keys SET last_used_at = NOW() WHERE id = ? AND user_id = ?`, key.ID, userID)
	s.getConversation(w, r, userID, conversationID)
}

var errConversationNoLongerMutable = errors.New("conversation no longer mutable")

// The model request happens outside a transaction. Recheck every mutable resource
// before writing its result so a user lock cannot be overwritten by a late response.
func (s *server) persistCompletionReview(ctx context.Context, userID uint64, conversation conversationResponse, conversationID, claim string, output completionConversationOutput, reviewJSON string, config aiConfigSnapshot, stage string) error {
	if conversation.NodeID == nil {
		return errConversationNoLongerMutable
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var status string
	if err := tx.QueryRowContext(ctx, `SELECT status FROM node_conversations WHERE id = ? AND owner_id = ? FOR UPDATE`, conversationID, userID).Scan(&status); err != nil {
		return errConversationNoLongerMutable
	}
	if status != "active" {
		return errConversationNoLongerMutable
	}
	var nodeStage string
	var linkedConversation sql.NullString
	if err := tx.QueryRowContext(ctx, `SELECT stage, completion_conversation_id FROM execution_contracts WHERE id = ? FOR UPDATE`, *conversation.NodeID).Scan(&nodeStage, &linkedConversation); err != nil {
		return errConversationNoLongerMutable
	}
	if (nodeStage != "frozen" && nodeStage != "verified" && nodeStage != "needs_supplement") || !linkedConversation.Valid || linkedConversation.String != conversationID {
		return errConversationNoLongerMutable
	}
	messageID, err := newOpaqueID("message")
	if err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO node_conversation_messages (id, conversation_id, role, body, structured_payload_json, ai_config_json) VALUES (?, ?, 'assistant', ?, ?, ?)`, messageID, conversationID, output.Reply, mustJSON(output), mustJSON(config)); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE node_conversations SET latest_review_json = ?, ai_config_json = ? WHERE id = ? AND status = 'active'`, reviewJSON, mustJSON(config), conversationID); err != nil {
		return err
	}
	messagesJSON, _ := jsonValue(conversationToLegacyMessages(conversation.Messages, output.Reply))
	result, err := tx.ExecContext(ctx, `UPDATE execution_contracts SET stage = ?, completion_claim = ?, evidence_text = ?, ai_review_json = ?, completion_review_ai_config_json = ?, review_messages_json = ? WHERE id = ? AND completion_conversation_id = ? AND stage IN ('frozen', 'verified', 'needs_supplement')`, stage, claim, claim, reviewJSON, mustJSON(config), messagesJSON, *conversation.NodeID, conversationID)
	if err != nil {
		return err
	}
	updated, _ := result.RowsAffected()
	if updated != 1 {
		return errConversationNoLongerMutable
	}
	return tx.Commit()
}

func (s *server) persistAssistantConversationMessage(ctx context.Context, conversationID, body, payload string, config aiConfigSnapshot) error {
	id, err := newOpaqueID("message")
	if err != nil {
		return err
	}
	_, err = s.db.ExecContext(ctx, `INSERT INTO node_conversation_messages (id, conversation_id, role, body, structured_payload_json, ai_config_json) VALUES (?, ?, 'assistant', ?, ?, ?)`, id, conversationID, body, payload, mustJSON(config))
	return err
}

func mustJSON(value any) string { result, _ := jsonValue(value); return result }

func requestPlanningConversation(ctx context.Context, key aiStoredKey, conversation conversationResponse, freezeReview bool) (planningConversationOutput, error) {
	var output planningConversationOutput
	system := "你是 ExecG 的行动契约协作者。通过多轮中文对话把用户模糊想法收敛为一次真实推进。契约必须有标题、可验证目标、至少两条可审查验收标准、证据要求。不要假装用户已经完成。规则引导型项目必须遵从项目规则；其他项目只帮助澄清。回应友好、简洁，指出下一步需要补什么。只返回 JSON。"
	if freezeReview {
		system += "当前用户明确请求冻结审核。只有草案完整且每条标准可独立审核时，readyForFreezeReview 才能为 true。"
	}
	payload := map[string]any{"context": conversation.Context, "currentDraft": conversation.CurrentDraft, "messages": conversation.Messages, "requiredJSONResponse": map[string]any{"reply": "中文回复", "draft": actionDraft{}, "readyForFreezeReview": false}}
	if err := callConversationModel(ctx, key, system, payload, &output); err != nil {
		return output, err
	}
	output.Draft.Title = strings.TrimSpace(output.Draft.Title)
	output.Draft.VerifiableGoal = strings.TrimSpace(output.Draft.VerifiableGoal)
	output.Draft.EvidenceRequirement = strings.TrimSpace(output.Draft.EvidenceRequirement)
	return output, nil
}

func requestCompletionConversation(ctx context.Context, key aiStoredKey, conversation conversationResponse) (completionConversationOutput, error) {
	var output completionConversationOutput
	system := "你是 ExecG 的行动证据审查员。对话围绕已经冻结的任务规则展开，逐轮检查用户提交的证据和解释。不能修改目标、验收标准或证据要求，不能把新工作补写为旧证据；发现新工作应指出需要另建补充节点。每次都逐条作出当前结论。只返回 JSON。"
	payload := map[string]any{"context": conversation.Context, "messages": conversation.Messages, "requiredJSONResponse": map[string]any{"reply": "中文回复", "review": map[string]any{"verdict": "pass|partial|fail", "summary": "中文摘要", "criterionReviews": []map[string]string{{"criterionId": "C1", "result": "met|unclear|unmet", "reason": "中文理由"}}, "suggestedSupplementTitle": "可为空"}, "requiresSupplement": false}}
	if err := callConversationModel(ctx, key, system, payload, &output); err != nil {
		return output, err
	}
	return output, nil
}

func callConversationModel(ctx context.Context, key aiStoredKey, system string, payload any, target any) error {
	definition, ok := aiProviderDefinitions[key.Provider]
	if !ok {
		return fmt.Errorf("AI 服务不支持")
	}
	contentBytes, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return err
	}
	var endpoint string
	var requestBody any
	if definition.AuthStyle == "anthropic" {
		endpoint = strings.TrimRight(key.BaseURL, "/") + "/messages"
		requestBody = map[string]any{"model": key.Model, "max_tokens": 8192, "temperature": 0, "system": system, "messages": []map[string]string{{"role": "user", "content": string(contentBytes)}}}
	} else {
		endpoint = strings.TrimRight(key.BaseURL, "/") + "/chat/completions"
		requestBody = map[string]any{"model": key.Model, "max_tokens": 8192, "temperature": 0, "messages": []map[string]string{{"role": "system", "content": system}, {"role": "user", "content": string(contentBytes)}}, "response_format": map[string]string{"type": "json_object"}}
	}
	body, err := json.Marshal(requestBody)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if definition.AuthStyle == "anthropic" {
		req.Header.Set("x-api-key", key.APIKey)
		req.Header.Set("anthropic-version", "2023-06-01")
	} else {
		req.Header.Set("Authorization", "Bearer "+key.APIKey)
	}
	response, err := (&http.Client{Timeout: 80 * time.Second}).Do(req)
	if err != nil {
		return fmt.Errorf("无法连接 AI 服务，请检查项目 AI 配置")
	}
	defer response.Body.Close()
	body, err = io.ReadAll(io.LimitReader(response.Body, 4<<20))
	if err != nil {
		return fmt.Errorf("读取 AI 回复失败")
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return fmt.Errorf("AI 审查失败：服务商返回 HTTP %d", response.StatusCode)
	}
	content, err := extractAIMessageContent(key.Provider, body)
	if err != nil {
		return err
	}
	if err := json.Unmarshal([]byte(extractJSONObject(content)), target); err != nil {
		return fmt.Errorf("AI 返回的对话结果不是可解析的 JSON")
	}
	return nil
}

func reviewRequestFromConversation(conversation conversationResponse) reviewExecutionNodeRequest {
	request := reviewExecutionNodeRequest{}
	contextBytes, _ := json.Marshal(conversation.Context)
	var contextData struct {
		Project reviewProjectRequest `json:"project"`
		Node    struct {
			Title               string                   `json:"title"`
			VerifiableGoal      string                   `json:"verifiableGoal"`
			AcceptanceCriteria  []reviewCriterionRequest `json:"acceptanceCriteria"`
			EvidenceRequirement string                   `json:"evidenceRequirement"`
		} `json:"node"`
	}
	_ = json.Unmarshal(contextBytes, &contextData)
	request.Project = contextData.Project
	request.Title = contextData.Node.Title
	request.VerifiableGoal = contextData.Node.VerifiableGoal
	request.AcceptanceCriteria = contextData.Node.AcceptanceCriteria
	request.EvidenceRequirement = contextData.Node.EvidenceRequirement
	return request
}

func conversationToLegacyMessages(messages []conversationMessageResponse, pendingAssistant string) []map[string]any {
	result := make([]map[string]any, 0, len(messages)+1)
	for _, message := range messages {
		speaker := "user"
		if message.Role == "assistant" {
			speaker = "ai"
		}
		result = append(result, map[string]any{"id": message.ID, "speaker": speaker, "body": message.Body, "createdAt": message.CreatedAt})
	}
	result = append(result, map[string]any{"id": "pending-ai", "speaker": "ai", "body": pendingAssistant, "createdAt": time.Now()})
	return result
}

// A frozen node keeps its planning exchange in the public node ledger as well as in its source conversation.
func (s *server) copyPlanningConversationToNodeMessages(ctx context.Context, conversationID, nodeID string, userID uint64) {
	rows, err := s.db.QueryContext(ctx, `SELECT m.id, m.role, m.body, m.created_at FROM node_conversation_messages m JOIN node_conversations c ON c.id = m.conversation_id WHERE m.conversation_id = ? AND c.owner_id = ? ORDER BY m.created_at ASC, m.id ASC`, conversationID, userID)
	if err != nil {
		return
	}
	defer rows.Close()
	messages := make([]map[string]any, 0)
	for rows.Next() {
		var id, role, body string
		var createdAt time.Time
		if rows.Scan(&id, &role, &body, &createdAt) != nil {
			return
		}
		speaker := "user"
		if role == "assistant" {
			speaker = "ai"
		}
		messages = append(messages, map[string]any{"id": id, "speaker": speaker, "body": body, "createdAt": createdAt})
	}
	if rows.Err() != nil {
		return
	}
	messageID, err := newOpaqueID("message")
	if err != nil {
		return
	}
	messages = append(messages, map[string]any{"id": messageID, "speaker": "ai", "body": "目标对话已完成，节点草案通过冻结审核，目标、验收标准和证据要求已冻结。", "createdAt": time.Now()})
	encoded, err := jsonValue(messages)
	if err != nil {
		return
	}
	_, _ = s.db.ExecContext(ctx, `UPDATE execution_contracts SET review_messages_json = ? WHERE id = ?`, encoded, nodeID)
}
