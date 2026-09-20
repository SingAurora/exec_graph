package workflow

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

	conversationpersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/conversation"
	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
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
	ParentContractID       string   `json:"parentContractId"`
	SourceContractIDs      []string `json:"sourceContractIds"`
	BranchID               string   `json:"branchId"`
	Fork                   bool     `json:"fork"`
	ClosureSourceIDs       []string `json:"closureSourceIds"`
	SupplementOfContractID string   `json:"supplementOfContractId"`
	RetryOfContractID      string   `json:"retryOfContractId"`
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

func (h *Handler) createPlanningConversation(w http.ResponseWriter, r *http.Request, userID uint64, projectID string) {
	var input createConversationRequest
	if !bindJSON(w, r, &input) {
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), sharedconstants.ConversationSetupTimeout)
	defer cancel()
	if _, err := h.loadProjectAIKey(ctx, userID, projectID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusBadRequest, "请先为项目选择审查 AI")
			return
		}
		writeError(w, http.StatusInternalServerError, "读取项目审查 AI 失败")
		return
	}
	project, err := h.conversations.FindProjectContext(ctx, userID, projectID)
	if err != nil {
		writeError(w, http.StatusNotFound, "项目不存在")
		return
	}
	if project.ArchivedAt != nil {
		writeError(w, http.StatusBadRequest, "项目已归档，不能创建推进")
		return
	}
	sourceIDs := uniqueNonEmpty(append(append([]string{}, input.SourceContractIDs...), input.ParentContractID, input.SupplementOfContractID, input.RetryOfContractID))
	sources, err := h.loadPlanningSourceContext(ctx, projectID, sourceIDs)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取行动上下文失败")
		return
	}
	conversationContext := map[string]any{
		"project":  map[string]string{"title": project.Title, "description": project.Description, "rules": project.Rules},
		"relation": input,
		"sources":  sources,
	}
	if project.ContributionCallID != nil {
		callID, err := h.conversations.FindCallUUID(ctx, *project.ContributionCallID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "读取协作交接上下文失败")
			return
		}
		origin, err := h.project.ContributionOrigin(ctx, callID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "读取协作交接上下文失败")
			return
		}
		conversationContext["contributionOrigin"] = origin
	}
	contextJSON, _ := jsonValue(conversationContext)
	existing, err := h.conversations.FindPlanningConversation(ctx, userID, projectID, contextJSON)
	if err == nil {
		h.getConversation(w, r, userID, existing.UUID)
		return
	}
	if !errors.Is(err, conversationpersistence.ErrNotFound) {
		writeError(w, http.StatusInternalServerError, "读取目标对话失败")
		return
	}
	id, err := newOpaqueID("conversation")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "创建对话失败")
		return
	}
	if err := h.conversations.CreatePlanningConversation(ctx, id, userID, projectID, contextJSON); err != nil {
		writeError(w, http.StatusInternalServerError, "创建对话失败")
		return
	}
	h.getConversation(w, r, userID, id)
}

// Planning should continue from the actual prior result rather than only a node ID.
// Sealed attempts are included as context but never become accepted dependencies.
func (h *Handler) loadPlanningSourceContext(ctx context.Context, projectID string, sourceIDs []string) ([]map[string]any, error) {
	sources := make([]map[string]any, 0, len(sourceIDs))
	for _, sourceID := range sourceIDs {
		values, err := h.conversations.ListSourceContexts(ctx, projectID, []string{sourceID})
		if err != nil {
			return nil, err
		}
		if len(values) == 0 {
			continue
		}
		value := values[0]
		source := map[string]any{
			"id": sourceID, "title": value.Title, "verifiableGoal": value.Goal, "evidenceRequirement": value.EvidenceRequirement,
			"stage": value.Stage, "completionClaim": value.CompletionClaim, "evidenceText": value.EvidenceText,
		}
		if value.ReviewJSON != nil {
			source["latestReview"] = decodeJSONValue(*value.ReviewJSON, nil)
		}
		sources = append(sources, source)
	}
	return sources, nil
}

func (h *Handler) createCompletionConversation(w http.ResponseWriter, r *http.Request, userID uint64, projectID, nodeID string) {
	ctx, cancel := context.WithTimeout(r.Context(), sharedconstants.ConversationSetupTimeout)
	defer cancel()
	conversation, err := h.conversations.FindCompletionConversation(ctx, userID, projectID, nodeID)
	if err == nil {
		h.getConversation(w, r, userID, conversation.UUID)
		return
	}
	if !errors.Is(err, conversationpersistence.ErrNotFound) {
		writeError(w, http.StatusInternalServerError, "读取审查对话失败")
		return
	}
	key, err := h.loadProjectAIKey(ctx, userID, projectID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "请先为项目选择审查 AI")
		return
	}
	contextValue, err := h.conversations.FindCompletionContext(ctx, userID, projectID, nodeID)
	if err != nil {
		writeError(w, http.StatusNotFound, "节点不存在")
		return
	}
	if contextValue.Stage == "completed" || contextValue.Stage == "sealed" {
		writeError(w, http.StatusBadRequest, "节点已锁定，不能继续审查")
		return
	}
	contextJSON, _ := jsonValue(map[string]any{"project": map[string]string{"title": contextValue.ProjectTitle, "description": contextValue.ProjectDescription, "rules": contextValue.Rules}, "node": map[string]any{"title": contextValue.NodeTitle, "verifiableGoal": contextValue.Goal, "acceptanceCriteria": json.RawMessage(contextValue.AcceptanceCriteriaJSON), "evidenceRequirement": contextValue.EvidenceRequirement}})
	id, err := newOpaqueID("conversation")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "创建审查对话失败")
		return
	}
	configJSON, _ := jsonValue(key.snapshot())
	if err := h.conversations.CreateCompletionConversation(ctx, id, userID, projectID, nodeID, contextJSON, configJSON); err != nil {
		writeError(w, http.StatusInternalServerError, "创建审查对话失败")
		return
	}
	h.getConversation(w, r, userID, id)
}

func (h *Handler) getConversation(w http.ResponseWriter, r *http.Request, userID uint64, id string) {
	ctx, cancel := context.WithTimeout(r.Context(), sharedconstants.ConversationSetupTimeout)
	defer cancel()
	conversation, err := h.loadConversation(ctx, userID, id)
	if errors.Is(err, conversationpersistence.ErrNotFound) {
		writeError(w, http.StatusNotFound, "对话不存在")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取对话失败")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"conversation": conversation})
}

func (h *Handler) loadConversation(ctx context.Context, userID uint64, id string) (conversationResponse, error) {
	var result conversationResponse
	view, err := h.conversations.FindConversation(ctx, userID, id)
	if err != nil {
		return result, err
	}
	conversation := view.Conversation
	result.ID = conversation.UUID
	result.ProjectID = view.ProjectID
	result.NodeID = view.NodeID
	result.Phase = conversation.Phase
	result.Status = conversation.Status
	result.Context = decodeJSONValue(conversation.ContextJSON, map[string]any{})
	result.CreatedAt = conversation.CreatedAt
	result.UpdatedAt = conversation.UpdatedAt
	if conversation.CurrentDraftJSON != nil {
		var value actionDraft
		if json.Unmarshal([]byte(*conversation.CurrentDraftJSON), &value) == nil {
			result.CurrentDraft = &value
		}
	}
	if conversation.LatestReviewJSON != nil {
		result.LatestReview = decodeJSONValue(*conversation.LatestReviewJSON, nil)
	}
	if conversation.AIConfigJSON != nil {
		var value aiConfigSnapshot
		if json.Unmarshal([]byte(*conversation.AIConfigJSON), &value) == nil {
			result.AIConfig = &value
		}
	}
	result.Messages = []conversationMessageResponse{}
	for _, stored := range view.Messages {
		item := conversationMessageResponse{ID: stored.UUID, Role: stored.Role, Body: stored.Body, CreatedAt: stored.CreatedAt}
		if stored.StructuredPayloadJSON != nil {
			item.StructuredPayload = decodeJSONValue(*stored.StructuredPayloadJSON, nil)
		}
		if stored.AIConfigJSON != nil {
			var value aiConfigSnapshot
			if json.Unmarshal([]byte(*stored.AIConfigJSON), &value) == nil {
				item.AIConfig = &value
			}
		}
		result.Messages = append(result.Messages, item)
	}
	return result, nil
}

func (h *Handler) sendConversationMessage(w http.ResponseWriter, r *http.Request, userID uint64, conversationID string, freezeReview bool) {
	var input sendConversationMessageRequest
	if !freezeReview {
		if !bindJSON(w, r, &input) {
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
	ctx, cancel := context.WithTimeout(r.Context(), sharedconstants.ConversationReviewTimeout)
	defer cancel()
	conversation, err := h.loadConversation(ctx, userID, conversationID)
	if errors.Is(err, conversationpersistence.ErrNotFound) {
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
	key, err := h.loadProjectAIKey(ctx, userID, conversation.ProjectID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "项目审查 AI 不可用")
		return
	}
	userMessageID, err := newOpaqueID("message")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存消息失败")
		return
	}
	if err := h.conversations.AddUserMessage(ctx, userMessageID, userID, conversationID, input.Body); err != nil {
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
		assistantMessageID, err := newOpaqueID("message")
		if err != nil {
			writeError(w, http.StatusInternalServerError, "保存 AI 回复失败")
			return
		}
		if err := h.conversations.UpdatePlanningConversation(ctx, userID, conversationID, status, draftJSON, assistantMessageID, output.Reply, payloadJSON, mustJSON(key.snapshot())); err != nil {
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
		if err := h.persistCompletionReview(ctx, userID, conversation, conversationID, input.Body, output, reviewJSON, key.snapshot(), stage); err != nil {
			if errors.Is(err, errConversationNoLongerMutable) {
				writeError(w, http.StatusConflict, "节点已锁定或审查对话已结束，本轮 AI 结果未写入")
				return
			}
			writeError(w, http.StatusInternalServerError, "保存审查结果失败")
			return
		}
	}
	_ = h.aiKey.MarkUsed(ctx, userID, key.UUID)
	h.getConversation(w, r, userID, conversationID)
}

var errConversationNoLongerMutable = errors.New("conversation no longer mutable")

// The model request happens outside a transaction. Recheck every mutable resource
// before writing its result so a user lock cannot be overwritten by a late response.
func (h *Handler) persistCompletionReview(ctx context.Context, userID uint64, conversation conversationResponse, conversationID, claim string, output completionConversationOutput, reviewJSON string, config aiConfigSnapshot, stage string) error {
	if conversation.NodeID == nil {
		return errConversationNoLongerMutable
	}
	messageID, err := newOpaqueID("message")
	if err != nil {
		return err
	}
	messagesJSON, _ := jsonValue(conversationToLegacyMessages(conversation.Messages, output.Reply))
	// Completion conversations are for clarification after a formal submission.
	// Preserve the original claim and evidence when an older client sends a message here.
	if err := h.conversations.PersistCompletionReview(ctx, userID, conversationID, *conversation.NodeID, claim, stage, reviewJSON, mustJSON(config), messagesJSON, mustJSON(output), output.Reply, messageID); err != nil {
		return errConversationNoLongerMutable
	}
	return nil
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
	contentBytes, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return err
	}
	content, err := requestConversationModelContent(ctx, key, system, string(contentBytes))
	if err != nil {
		return err
	}
	if err := decodeConversationJSON(content, target); err == nil {
		return nil
	}

	// Some compatible models ignore JSON mode occasionally. Give the same model
	// one bounded chance to repair its own response before surfacing an error.
	schema, err := json.Marshal(target)
	if err != nil {
		return fmt.Errorf("生成 AI 对话结果结构失败")
	}
	repairPayload, err := json.Marshal(map[string]any{
		"invalidModelOutput": content,
		"requiredJSONShape":  json.RawMessage(schema),
	})
	if err != nil {
		return fmt.Errorf("生成 AI 对话修复请求失败")
	}
	repairSystem := "你是 JSON 输出修复器。将用户提供的模型输出转换为符合 requiredJSONShape 的 JSON 对象。保留原意；缺失字段使用空字符串、false 或空数组。只输出一个有效 JSON 对象，不要 Markdown、解释或代码围栏。"
	repaired, err := requestConversationModelContent(ctx, key, repairSystem, string(repairPayload))
	if err != nil {
		return err
	}
	if err := decodeConversationJSON(repaired, target); err != nil {
		return fmt.Errorf("AI 返回的对话结果不是可解析的 JSON；已尝试自动修复，请重试或更换模型")
	}
	return nil
}

func requestConversationModelContent(ctx context.Context, key aiStoredKey, system, userContent string) (string, error) {
	definition, ok := aiProviderDefinitions[key.Provider]
	if !ok {
		return "", fmt.Errorf("AI 服务不支持")
	}
	var endpoint string
	var requestBody any
	if definition.AuthStyle == "anthropic" {
		endpoint = strings.TrimRight(key.BaseURL, "/") + "/messages"
		requestBody = map[string]any{"model": key.Model, "max_tokens": 8192, "temperature": 0, "system": system, "messages": []map[string]string{{"role": "user", "content": userContent}}}
	} else {
		endpoint = strings.TrimRight(key.BaseURL, "/") + "/chat/completions"
		requestBody = map[string]any{"model": key.Model, "max_tokens": 8192, "temperature": 0, "messages": []map[string]string{{"role": "system", "content": system}, {"role": "user", "content": userContent}}, "response_format": map[string]string{"type": "json_object"}}
	}
	body, err := json.Marshal(requestBody)
	if err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	if definition.AuthStyle == "anthropic" {
		req.Header.Set("x-api-key", key.APIKey)
		req.Header.Set("anthropic-version", "2023-06-01")
	} else {
		req.Header.Set("Authorization", "Bearer "+key.APIKey)
	}
	response, err := (&http.Client{Timeout: sharedconstants.ConversationModelHTTPTimeout}).Do(req)
	if err != nil {
		return "", fmt.Errorf("无法连接 AI 服务，请检查项目 AI 配置")
	}
	defer response.Body.Close()
	body, err = io.ReadAll(io.LimitReader(response.Body, 4<<20))
	if err != nil {
		return "", fmt.Errorf("读取 AI 回复失败")
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return "", fmt.Errorf("AI 审查失败：服务商返回 HTTP %d", response.StatusCode)
	}
	content, err := extractAIMessageContent(key.Provider, body)
	if err != nil {
		return "", err
	}
	return content, nil
}

func decodeConversationJSON(content string, target any) error {
	var quoted string
	if err := json.Unmarshal([]byte(strings.TrimSpace(content)), &quoted); err == nil {
		if err := json.Unmarshal([]byte(extractJSONObject(quoted)), target); err == nil {
			return nil
		}
	}
	candidate := extractJSONObject(content)
	if err := json.Unmarshal([]byte(candidate), target); err == nil {
		return nil
	}
	return fmt.Errorf("invalid JSON")
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
