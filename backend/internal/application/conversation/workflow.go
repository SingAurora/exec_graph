package conversation

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	applicationaigateway "github.com/singaurora/exec-graph/backend/internal/application/aigateway"
	applicationaikey "github.com/singaurora/exec-graph/backend/internal/application/aikey"
	applicationproject "github.com/singaurora/exec-graph/backend/internal/application/project"
	applicationreview "github.com/singaurora/exec-graph/backend/internal/application/review"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
	sharedid "github.com/singaurora/exec-graph/backend/internal/shared/id"
)

type planningSource struct {
	ID                  string  `json:"uuid"`
	Title               string  `json:"title"`
	VerifiableGoal      string  `json:"verifiableGoal"`
	EvidenceRequirement string  `json:"evidenceRequirement"`
	Stage               string  `json:"stage"`
	CompletionClaim     *string `json:"completionClaim"`
	EvidenceText        *string `json:"evidenceText"`
	LatestReview        any     `json:"latestReview,omitempty"`
}

type planningContext struct {
	Project struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		Rules       string `json:"rules"`
	} `json:"project"`
	Relation           OpenPlanningInput                      `json:"relation"`
	Sources            []planningSource                       `json:"sources"`
	ContributionOrigin *applicationproject.ContributionOrigin `json:"contributionOrigin,omitempty"`
}

type completionContextPayload struct {
	Project struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		Rules       string `json:"rules"`
	} `json:"project"`
	Node struct {
		Title               string          `json:"title"`
		VerifiableGoal      string          `json:"verifiableGoal"`
		AcceptanceCriteria  json.RawMessage `json:"acceptanceCriteria"`
		EvidenceRequirement string          `json:"evidenceRequirement"`
	} `json:"node"`
}

type planningConversationOutput struct {
	Reply          string      `json:"reply"`
	Draft          ActionDraft `json:"draft"`
	ReadyForFreeze bool        `json:"readyForFreezeReview"`
}

type completionConversationOutput struct {
	Reply              string                        `json:"reply"`
	Review             applicationreview.ModelOutput `json:"review"`
	RequiresSupplement bool                          `json:"requiresSupplement"`
}

// OpenPlanningConversation 返回已有的同上下文规划对话，或创建一份新对话。
func (service *Service) OpenPlanningConversation(ctx context.Context, userID uint64, input OpenPlanningInput) (View, error) {
	input.ProjectUUID = strings.TrimSpace(input.ProjectUUID)
	if input.ProjectUUID == "" {
		return View{}, fault.New(fault.InvalidRequest, "缺少项目 UUID")
	}
	if _, _, err := service.projectConfiguration(ctx, userID, input.ProjectUUID); err != nil {
		return View{}, err
	}
	project, err := service.repository.FindProjectContext(ctx, userID, input.ProjectUUID)
	if err != nil {
		return View{}, mapRepositoryError(err, "项目不存在", "读取项目失败")
	}
	if project.ArchivedAt != nil {
		return View{}, fault.New(fault.InvalidRequest, "项目已归档，不能创建推进")
	}
	sourceIDs := uniqueNonEmpty(append(append([]string{}, input.SourceContractUUIDs...), input.ParentContractUUID, input.SupplementOfContractUUID, input.RetryOfContractUUID))
	sources, err := service.loadPlanningSources(ctx, input.ProjectUUID, sourceIDs)
	if err != nil {
		return View{}, fault.Wrap(fault.Internal, "读取行动上下文失败", err)
	}
	conversationContext := planningContext{Relation: input, Sources: sources}
	conversationContext.Project.Title = project.Title
	conversationContext.Project.Description = project.Description
	conversationContext.Project.Rules = project.Rules
	if project.ContributionCallID != nil {
		origin, err := service.contributionOrigins.GetContributionOrigin(ctx, *project.ContributionCallID)
		if err != nil {
			return View{}, fault.Wrap(fault.Internal, "读取协作交接上下文失败", err)
		}
		conversationContext.ContributionOrigin = &origin
	}
	contextJSON, err := marshal(conversationContext)
	if err != nil {
		return View{}, fault.Wrap(fault.Internal, "创建对话上下文失败", err)
	}
	conversationID, err := service.repository.FindPlanningConversation(ctx, userID, input.ProjectUUID, contextJSON)
	if err == nil {
		return service.GetConversation(ctx, userID, conversationID)
	}
	if !errors.Is(err, ErrNotFound) {
		return View{}, fault.Wrap(fault.Internal, "读取目标对话失败", err)
	}
	conversationID, err = sharedid.UUID()
	if err != nil {
		return View{}, fault.Wrap(fault.Internal, "创建对话失败", err)
	}
	if err := service.repository.CreatePlanningConversation(ctx, conversationID, userID, input.ProjectUUID, contextJSON); err != nil {
		return View{}, fault.Wrap(fault.Internal, "创建对话失败", err)
	}
	return service.GetConversation(ctx, userID, conversationID)
}

// OpenCompletionConversation 返回已有的节点审查对话，或创建一份新对话。
func (service *Service) OpenCompletionConversation(ctx context.Context, userID uint64, input OpenCompletionInput) (View, error) {
	input.ProjectUUID = strings.TrimSpace(input.ProjectUUID)
	input.NodeUUID = strings.TrimSpace(input.NodeUUID)
	if input.ProjectUUID == "" || input.NodeUUID == "" {
		return View{}, fault.New(fault.InvalidRequest, "缺少项目或节点 UUID")
	}
	conversationID, err := service.repository.FindCompletionConversation(ctx, userID, input.ProjectUUID, input.NodeUUID)
	if err == nil {
		return service.GetConversation(ctx, userID, conversationID)
	}
	if !errors.Is(err, ErrNotFound) {
		return View{}, fault.Wrap(fault.Internal, "读取审查对话失败", err)
	}
	configuration, _, err := service.projectConfiguration(ctx, userID, input.ProjectUUID)
	if err != nil {
		return View{}, err
	}
	contextValue, err := service.repository.FindCompletionContext(ctx, userID, input.ProjectUUID, input.NodeUUID)
	if err != nil {
		return View{}, mapRepositoryError(err, "节点不存在", "读取节点失败")
	}
	if contextValue.Stage == "completed" || contextValue.Stage == "sealed" {
		return View{}, fault.New(fault.Conflict, "节点已锁定，不能继续审查")
	}
	payload := completionContextPayload{}
	payload.Project.Title, payload.Project.Description, payload.Project.Rules = contextValue.ProjectTitle, contextValue.ProjectDescription, contextValue.Rules
	payload.Node.Title, payload.Node.VerifiableGoal = contextValue.NodeTitle, contextValue.Goal
	payload.Node.AcceptanceCriteria = json.RawMessage(contextValue.AcceptanceCriteriaJSON)
	payload.Node.EvidenceRequirement = contextValue.EvidenceRequirement
	contextJSON, err := marshal(payload)
	if err != nil {
		return View{}, fault.Wrap(fault.Internal, "创建审查对话失败", err)
	}
	conversationID, err = sharedid.UUID()
	if err != nil {
		return View{}, fault.Wrap(fault.Internal, "创建审查对话失败", err)
	}
	configJSON, err := marshal(configuration.Snapshot)
	if err != nil {
		return View{}, fault.Wrap(fault.Internal, "创建审查对话失败", err)
	}
	if err := service.repository.CreateCompletionConversation(ctx, conversationID, userID, input.ProjectUUID, input.NodeUUID, contextJSON, configJSON); err != nil {
		return View{}, fault.Wrap(fault.Internal, "创建审查对话失败", err)
	}
	return service.GetConversation(ctx, userID, conversationID)
}

// GetConversation 返回当前用户拥有的一份对话。
func (service *Service) GetConversation(ctx context.Context, userID uint64, conversationUUID string) (View, error) {
	conversationUUID = strings.TrimSpace(conversationUUID)
	if conversationUUID == "" {
		return View{}, fault.New(fault.InvalidRequest, "缺少对话 UUID")
	}
	stored, err := service.repository.FindConversation(ctx, userID, conversationUUID)
	if err != nil {
		return View{}, mapRepositoryError(err, "对话不存在", "读取对话失败")
	}
	return conversationView(stored), nil
}

// SendMessage 追加用户消息，调用模型并保存新的规划或审查状态。
func (service *Service) SendMessage(ctx context.Context, userID uint64, conversationUUID, body string, freezeReview bool) (View, error) {
	conversationUUID = strings.TrimSpace(conversationUUID)
	body = strings.TrimSpace(body)
	if conversationUUID == "" {
		return View{}, fault.New(fault.InvalidRequest, "缺少对话 UUID")
	}
	if body == "" {
		return View{}, fault.New(fault.InvalidRequest, "请输入要发送的内容")
	}
	conversation, err := service.GetConversation(ctx, userID, conversationUUID)
	if err != nil {
		return View{}, err
	}
	if conversation.Status == "frozen" || conversation.Status == "closed" {
		return View{}, fault.New(fault.Conflict, "对话已结束")
	}
	configuration, keyID, err := service.projectConfiguration(ctx, userID, conversation.ProjectID)
	if err != nil {
		return View{}, err
	}
	userMessageID, err := sharedid.UUID()
	if err != nil {
		return View{}, fault.Wrap(fault.Internal, "保存消息失败", err)
	}
	if err := service.repository.AddUserMessage(ctx, userMessageID, userID, conversationUUID, body); err != nil {
		return View{}, fault.Wrap(fault.Internal, "保存消息失败", err)
	}
	conversation.Messages = append(conversation.Messages, MessageView{ID: userMessageID, Role: "user", Body: body, CreatedAt: time.Now()})
	if conversation.Phase == "planning" {
		if err := service.processPlanningMessage(ctx, userID, conversationUUID, conversation, configuration, keyID, freezeReview); err != nil {
			return View{}, err
		}
	} else {
		if err := service.processCompletionMessage(ctx, userID, conversationUUID, body, conversation, configuration, keyID); err != nil {
			return View{}, err
		}
	}
	return service.GetConversation(ctx, userID, conversationUUID)
}

func (service *Service) processPlanningMessage(ctx context.Context, userID uint64, conversationUUID string, conversation View, configuration applicationreview.ModelConfiguration, keyID string, freezeReview bool) error {
	output, err := service.requestPlanningConversation(ctx, configuration.Credential, conversation, freezeReview)
	if err != nil {
		return fault.Wrap(fault.UpstreamFailure, err.Error(), err)
	}
	if strings.TrimSpace(output.Reply) == "" {
		output.Reply = "我已更新行动契约草案，请检查右侧内容。"
	}
	status := "active"
	if output.ReadyForFreeze {
		status = "ready_for_freeze"
	}
	messageID, err := sharedid.UUID()
	if err != nil {
		return fault.Wrap(fault.Internal, "保存 AI 回复失败", err)
	}
	draftJSON, err := marshal(output.Draft)
	if err != nil {
		return fault.Wrap(fault.Internal, "保存对话状态失败", err)
	}
	payloadJSON, err := marshal(output)
	if err != nil {
		return fault.Wrap(fault.Internal, "保存对话状态失败", err)
	}
	configJSON, err := marshal(configuration.Snapshot)
	if err != nil {
		return fault.Wrap(fault.Internal, "保存对话状态失败", err)
	}
	if err := service.credentials.MarkAIKeyUsed(ctx, userID, keyID); err != nil {
		return fault.Wrap(fault.Internal, "保存 AI 使用记录失败", err)
	}
	if err := service.repository.UpdatePlanningConversation(ctx, userID, conversationUUID, status, draftJSON, messageID, output.Reply, payloadJSON, configJSON); err != nil {
		if errors.Is(err, ErrNoLongerMutable) {
			return fault.New(fault.Conflict, "对话已结束，本轮 AI 结果未写入")
		}
		return fault.Wrap(fault.Internal, "保存对话状态失败", err)
	}
	return nil
}

func (service *Service) processCompletionMessage(ctx context.Context, userID uint64, conversationUUID, claim string, conversation View, configuration applicationreview.ModelConfiguration, keyID string) error {
	output, err := service.requestCompletionConversation(ctx, configuration.Credential, conversation)
	if err != nil {
		return fault.Wrap(fault.UpstreamFailure, err.Error(), err)
	}
	if strings.TrimSpace(output.Reply) == "" {
		output.Reply = output.Review.Summary
	}
	review, err := service.reviewer.NormalizeCompletion(reviewRequestFromConversation(conversation), output.Review)
	if err != nil {
		return fault.Wrap(fault.Internal, "生成审查编号失败", err)
	}
	review.AIConfig = configuration.Snapshot
	if conversation.NodeID == nil {
		return fault.New(fault.Conflict, "节点已锁定或审查对话已结束，本轮 AI 结果未写入")
	}
	messageID, err := sharedid.UUID()
	if err != nil {
		return fault.Wrap(fault.Internal, "保存审查结果失败", err)
	}
	reviewJSON, err := marshal(review)
	if err != nil {
		return fault.Wrap(fault.Internal, "保存审查结果失败", err)
	}
	configJSON, err := marshal(configuration.Snapshot)
	if err != nil {
		return fault.Wrap(fault.Internal, "保存审查结果失败", err)
	}
	messagesJSON, err := marshal(conversationToReviewMessages(conversation.Messages, output.Reply))
	if err != nil {
		return fault.Wrap(fault.Internal, "保存审查结果失败", err)
	}
	payloadJSON, err := marshal(output)
	if err != nil {
		return fault.Wrap(fault.Internal, "保存审查结果失败", err)
	}
	if err := service.credentials.MarkAIKeyUsed(ctx, userID, keyID); err != nil {
		return fault.Wrap(fault.Internal, "保存 AI 使用记录失败", err)
	}
	stage := "needs_supplement"
	if review.Verdict == "pass" {
		stage = "verified"
	}
	err = service.repository.PersistCompletionReview(ctx, userID, conversationUUID, *conversation.NodeID, claim, stage, reviewJSON, configJSON, messagesJSON, payloadJSON, output.Reply, messageID)
	if errors.Is(err, ErrNoLongerMutable) {
		return fault.New(fault.Conflict, "节点已锁定或审查对话已结束，本轮 AI 结果未写入")
	}
	if err != nil {
		return fault.Wrap(fault.Internal, "保存审查结果失败", err)
	}
	return nil
}

func (service *Service) loadPlanningSources(ctx context.Context, projectUUID string, sourceIDs []string) ([]planningSource, error) {
	result := make([]planningSource, 0, len(sourceIDs))
	for _, sourceID := range sourceIDs {
		values, err := service.repository.ListSourceContexts(ctx, projectUUID, []string{sourceID})
		if err != nil {
			return nil, err
		}
		if len(values) == 0 {
			continue
		}
		value := values[0]
		item := planningSource{ID: sourceID, Title: value.Title, VerifiableGoal: value.Goal, EvidenceRequirement: value.EvidenceRequirement, Stage: value.Stage, CompletionClaim: value.CompletionClaim, EvidenceText: value.EvidenceText}
		if value.ReviewJSON != nil {
			item.LatestReview = decodeDynamicJSON(*value.ReviewJSON, nil)
		}
		result = append(result, item)
	}
	return result, nil
}

func conversationView(stored ConversationRecordView) View {
	record := stored.Conversation
	result := View{ID: record.UUID, ProjectID: stored.ProjectID, NodeID: stored.NodeID, Phase: record.Phase, Status: record.Status, Context: decodeDynamicJSON(record.ContextJSON, map[string]any{}), CreatedAt: record.CreatedAt, UpdatedAt: record.UpdatedAt, Messages: []MessageView{}}
	if record.CurrentDraftJSON != nil {
		var draft ActionDraft
		if json.Unmarshal([]byte(*record.CurrentDraftJSON), &draft) == nil {
			result.CurrentDraft = &draft
		}
	}
	if record.LatestReviewJSON != nil {
		result.LatestReview = decodeDynamicJSON(*record.LatestReviewJSON, nil)
	}
	if record.AIConfigJSON != nil {
		var configuration applicationreview.AIConfigSnapshot
		if json.Unmarshal([]byte(*record.AIConfigJSON), &configuration) == nil {
			result.AIConfig = &configuration
		}
	}
	for _, storedMessage := range stored.Messages {
		message := MessageView{ID: storedMessage.UUID, Role: storedMessage.Role, Body: storedMessage.Body, CreatedAt: storedMessage.CreatedAt}
		if storedMessage.StructuredPayloadJSON != nil {
			message.StructuredPayload = decodeDynamicJSON(*storedMessage.StructuredPayloadJSON, nil)
		}
		if storedMessage.AIConfigJSON != nil {
			var configuration applicationreview.AIConfigSnapshot
			if json.Unmarshal([]byte(*storedMessage.AIConfigJSON), &configuration) == nil {
				message.AIConfig = &configuration
			}
		}
		result.Messages = append(result.Messages, message)
	}
	return result
}

func (service *Service) projectConfiguration(ctx context.Context, userID uint64, projectUUID string) (applicationreview.ModelConfiguration, string, error) {
	key, err := service.credentials.FindProjectReviewKey(ctx, userID, projectUUID)
	if errors.Is(err, applicationaikey.ErrNotFound) {
		return applicationreview.ModelConfiguration{}, "", fault.New(fault.InvalidRequest, "请先为项目选择审查 AI")
	}
	if err != nil {
		return applicationreview.ModelConfiguration{}, "", fault.Wrap(fault.Internal, "读取项目审查 AI 失败", err)
	}
	configuration := applicationreview.ModelConfiguration{
		Credential: applicationaigateway.Credential{Provider: key.Provider, APIKey: key.Secret, BaseURL: key.BaseURL, Model: key.Model},
		Snapshot:   applicationreview.AIConfigSnapshot{KeyID: key.ID, Label: key.Label, Provider: key.Provider, Model: key.Model, BaseURL: key.BaseURL},
	}
	return configuration, key.ID, nil
}

func reviewRequestFromConversation(conversation View) applicationreview.CompletionRequest {
	request := applicationreview.CompletionRequest{}
	contextBytes, _ := json.Marshal(conversation.Context)
	var contextData struct {
		Project applicationreview.Project `json:"project"`
		Node    struct {
			Title               string                        `json:"title"`
			VerifiableGoal      string                        `json:"verifiableGoal"`
			AcceptanceCriteria  []applicationreview.Criterion `json:"acceptanceCriteria"`
			EvidenceRequirement string                        `json:"evidenceRequirement"`
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

func conversationToReviewMessages(messages []MessageView, pendingAssistant string) []applicationreview.ReviewMessage {
	result := make([]applicationreview.ReviewMessage, 0, len(messages)+1)
	for _, message := range messages {
		speaker := "user"
		if message.Role == "assistant" {
			speaker = "ai"
		}
		result = append(result, applicationreview.ReviewMessage{ID: message.ID, Speaker: speaker, Body: message.Body, CreatedAt: message.CreatedAt})
	}
	result = append(result, applicationreview.ReviewMessage{ID: "pending-ai", Speaker: "ai", Body: pendingAssistant, CreatedAt: time.Now()})
	return result
}

func uniqueNonEmpty(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}

func decodeDynamicJSON(value string, fallback any) any {
	var result any
	if json.Unmarshal([]byte(value), &result) != nil {
		return fallback
	}
	return result
}

func marshal(value any) (string, error) {
	encoded, err := json.Marshal(value)
	return string(encoded), err
}

func mapRepositoryError(err error, notFoundMessage, internalMessage string) error {
	if errors.Is(err, ErrNotFound) {
		return fault.Wrap(fault.NotFound, notFoundMessage, err)
	}
	return fault.Wrap(fault.Internal, internalMessage, err)
}
