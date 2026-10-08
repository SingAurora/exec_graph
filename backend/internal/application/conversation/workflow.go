package conversation

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	applicationaigateway "github.com/singaurora/exec-graph/backend/internal/application/aigateway"
	applicationaikey "github.com/singaurora/exec-graph/backend/internal/application/aikey"
	applicationproject "github.com/singaurora/exec-graph/backend/internal/application/project"
	applicationreview "github.com/singaurora/exec-graph/backend/internal/application/review"
	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
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
	SmartContract struct {
		ID          string `json:"uuid"`
		Name        string `json:"name"`
		Description string `json:"description"`
		Body        string `json:"body"`
	} `json:"smartContract"`
	Relation           OpenPlanningInput                      `json:"relation"`
	Revision           *RevisionTarget                        `json:"revision,omitempty"`
	Sources            []planningSource                       `json:"sources"`
	ContributionOrigin *applicationproject.ContributionOrigin `json:"contributionOrigin,omitempty"`
}

type completionContextPayload struct {
	Project struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		Rules       string `json:"rules"`
	} `json:"project"`
	SmartContract struct {
		ID          string `json:"uuid"`
		Name        string `json:"name"`
		Description string `json:"description"`
		Body        string `json:"body"`
	} `json:"smartContract"`
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

// OpenRevisionConversation 打开一份通过 AI 修改当前任务要求的对话。
func (service *Service) OpenRevisionConversation(ctx context.Context, userID uint64, input OpenRevisionInput) (View, error) {
	input.ProjectUUID = strings.TrimSpace(input.ProjectUUID)
	input.NodeUUID = strings.TrimSpace(input.NodeUUID)
	if input.ProjectUUID == "" || input.NodeUUID == "" {
		return View{}, fault.New(fault.InvalidRequest, "缺少项目或节点 UUID")
	}
	if _, _, err := service.projectConfiguration(ctx, userID, input.ProjectUUID); err != nil {
		return View{}, err
	}
	target, err := service.repository.FindRevisionTarget(ctx, userID, input.ProjectUUID, input.NodeUUID)
	if err != nil {
		return View{}, mapRepositoryError(err, "节点不存在", "读取任务要求失败")
	}
	if target.Archived || !target.Current {
		return View{}, fault.New(fault.Conflict, "只有项目当前行动可以修改任务要求")
	}
	if target.Stage != "frozen" || target.HasCompletionRecord {
		return View{}, fault.New(fault.Conflict, "任务完成状态已经固定，不能修改任务要求")
	}
	project, err := service.repository.FindProjectContext(ctx, userID, input.ProjectUUID)
	if err != nil {
		return View{}, mapRepositoryError(err, "项目不存在", "读取项目失败")
	}
	contextValue := planningContext{Relation: OpenPlanningInput{ProjectUUID: input.ProjectUUID, ParentContractUUID: input.NodeUUID}, Revision: &target}
	contextValue.Project.Title, contextValue.Project.Description, contextValue.Project.Rules = project.Title, project.Description, project.Rules
	contextValue.SmartContract.ID, contextValue.SmartContract.Name = project.SmartContractID, project.SmartContractName
	contextValue.SmartContract.Description, contextValue.SmartContract.Body = project.SmartContractDescription, project.SmartContractBody
	contextJSON, err := marshal(contextValue)
	if err != nil {
		return View{}, fault.Wrap(fault.Internal, "创建任务要求对话失败", err)
	}
	if conversationID, err := service.repository.FindRevisionConversation(ctx, userID, input.NodeUUID); err == nil {
		return service.GetConversation(ctx, userID, conversationID)
	} else if !errors.Is(err, ErrNotFound) {
		return View{}, fault.Wrap(fault.Internal, "读取任务要求对话失败", err)
	}
	conversationID, err := sharedid.UUID()
	if err != nil {
		return View{}, fault.Wrap(fault.Internal, "创建任务要求对话失败", err)
	}
	if err := service.repository.CreateRevisionConversation(ctx, conversationID, userID, input.ProjectUUID, input.NodeUUID, contextJSON); err != nil {
		return View{}, fault.Wrap(fault.Internal, "保存任务要求对话失败", err)
	}
	return service.GetConversation(ctx, userID, conversationID)
}

// FinalizeRevisionConversation 使用用户确认的 AI 草案替换任务要求，并清除旧完成对话。
func (service *Service) FinalizeRevisionConversation(ctx context.Context, userID uint64, input FinalizeRevisionInput) (View, error) {
	input.ConversationUUID = strings.TrimSpace(input.ConversationUUID)
	if input.ConversationUUID == "" {
		return View{}, fault.New(fault.InvalidRequest, "缺少对话 UUID")
	}
	conversation, err := service.GetConversation(ctx, userID, input.ConversationUUID)
	if err != nil {
		return View{}, err
	}
	if conversation.Phase != "planning" || conversation.Status != "ready_for_freeze" || conversation.CurrentDraft == nil {
		return View{}, fault.New(fault.Conflict, "请先通过对话确认新的任务要求")
	}
	var contextValue planningContext
	contextJSON, marshalErr := json.Marshal(conversation.Context)
	if marshalErr != nil || json.Unmarshal(contextJSON, &contextValue) != nil || contextValue.Revision == nil {
		return View{}, fault.New(fault.Conflict, "这不是任务要求修改对话")
	}
	if strings.TrimSpace(conversation.CurrentDraft.Title) == "" || strings.TrimSpace(conversation.CurrentDraft.VerifiableGoal) == "" || strings.TrimSpace(conversation.CurrentDraft.EvidenceRequirement) == "" || len(conversation.CurrentDraft.AcceptanceCriteria) == 0 {
		return View{}, fault.New(fault.InvalidRequest, "新的任务要求不完整")
	}
	criteria := make([]applicationreview.Criterion, 0, len(conversation.CurrentDraft.AcceptanceCriteria))
	for _, text := range conversation.CurrentDraft.AcceptanceCriteria {
		text = strings.TrimSpace(text)
		if text == "" {
			continue
		}
		criterionNumber := len(criteria) + 1
		criteria = append(criteria, applicationreview.Criterion{ID: fmt.Sprintf("c%d", criterionNumber), Text: text, RequiredEvidence: fmt.Sprintf("C%d：记录这项任务点的实际情况。", criterionNumber)})
	}
	if len(criteria) == 0 {
		return View{}, fault.New(fault.InvalidRequest, "新的任务要求至少需要一个任务点")
	}
	criteriaJSON, err := json.Marshal(criteria)
	if err != nil {
		return View{}, fault.Wrap(fault.Internal, "整理任务要求失败", err)
	}
	draftJSON, err := json.Marshal(conversation.CurrentDraft)
	if err != nil {
		return View{}, fault.Wrap(fault.Internal, "保存任务要求失败", err)
	}
	configJSON := "{}"
	if conversation.AIConfig != nil {
		configJSONBytes, marshalErr := json.Marshal(conversation.AIConfig)
		if marshalErr != nil {
			return View{}, fault.Wrap(fault.Internal, "保存任务要求失败", marshalErr)
		}
		configJSON = string(configJSONBytes)
	}
	reviewID, err := sharedid.UUID()
	if err != nil {
		return View{}, fault.Wrap(fault.Internal, "保存任务要求失败", err)
	}
	reviewJSONBytes, err := json.Marshal(map[string]any{
		"uuid": reviewID, "verdict": "pass", "summary": "任务要求已通过对话重新整理。",
		"missingRequirements": []string{}, "createdAt": time.Now(), "aiConfig": conversation.AIConfig,
	})
	if err != nil {
		return View{}, fault.Wrap(fault.Internal, "保存任务要求失败", err)
	}
	reviewJSON := string(reviewJSONBytes)
	messagesJSON, err := json.Marshal(conversationToReviewMessages(conversation.Messages, "任务要求已重新整理；旧完成说明已清空，请按新的行动要求重新记录实际完成情况。"))
	if err != nil {
		return View{}, fault.Wrap(fault.Internal, "保存任务要求对话失败", err)
	}
	intentLines := []string{"行动标题：" + conversation.CurrentDraft.Title, "行动目标：" + conversation.CurrentDraft.VerifiableGoal, "行动关注点："}
	for _, criterion := range criteria {
		intentLines = append(intentLines, "- "+criterion.Text)
	}
	intentLines = append(intentLines, "记录提示："+conversation.CurrentDraft.EvidenceRequirement)
	err = service.repository.SaveRevision(ctx, RevisionSave{UserID: userID, ConversationUUID: input.ConversationUUID, NodeUUID: contextValue.Revision.NodeUUID, Title: conversation.CurrentDraft.Title, Goal: conversation.CurrentDraft.VerifiableGoal, CriteriaJSON: string(criteriaJSON), EvidenceRequirement: conversation.CurrentDraft.EvidenceRequirement, OriginalIntent: strings.Join(intentLines, "\n"), DraftJSON: string(draftJSON), ReviewJSON: reviewJSON, AIConfigJSON: configJSON, MessagesJSON: string(messagesJSON)})
	if errors.Is(err, ErrNoLongerMutable) {
		return View{}, fault.New(fault.Conflict, "任务要求或完成状态已经变化，请刷新后重试")
	}
	if err != nil {
		return View{}, fault.Wrap(fault.Internal, "保存任务要求失败", err)
	}
	return service.GetConversation(ctx, userID, input.ConversationUUID)
}

type completionConversationReply struct {
	Reply string `json:"reply"`
}

type completionConversationConclusion struct {
	Reply  string                        `json:"reply"`
	Review applicationreview.ModelOutput `json:"review"`
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
	conversationContext.SmartContract.ID = project.SmartContractID
	conversationContext.SmartContract.Name = project.SmartContractName
	conversationContext.SmartContract.Description = project.SmartContractDescription
	conversationContext.SmartContract.Body = project.SmartContractBody
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
		if errors.Is(err, ErrNotFound) {
			return View{}, fault.New(fault.NotFound, "项目不存在或已无法继续推进")
		}
		return View{}, fault.Wrap(fault.Internal, "保存规划对话失败", err)
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
	if contextValue.Stage != "frozen" {
		return View{}, fault.New(fault.Conflict, "当前节点已经生成完成审查结论，不能重新开始审查")
	}
	payload := completionContextPayload{}
	payload.Project.Title, payload.Project.Description, payload.Project.Rules = contextValue.ProjectTitle, contextValue.ProjectDescription, contextValue.Rules
	payload.SmartContract.ID, payload.SmartContract.Name = contextValue.SmartContractID, contextValue.SmartContractName
	payload.SmartContract.Description, payload.SmartContract.Body = contextValue.SmartContractDescription, contextValue.SmartContractBody
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

// ClearConversation 清空一份尚未结束的规划或完成审查对话，保留上下文。
func (service *Service) ClearConversation(ctx context.Context, userID uint64, conversationUUID string) (View, error) {
	conversationUUID = strings.TrimSpace(conversationUUID)
	if conversationUUID == "" {
		return View{}, fault.New(fault.InvalidRequest, "缺少对话 UUID")
	}
	stored, err := service.repository.FindConversation(ctx, userID, conversationUUID)
	if err != nil {
		return View{}, mapRepositoryError(err, "对话不存在", "读取对话失败")
	}
	if stored.Conversation.Status == "frozen" || stored.Conversation.Status == "closed" {
		return View{}, fault.New(fault.Conflict, "对话已结束，不能清空")
	}
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	replacementUUID, err := sharedid.UUID()
	if err != nil {
		return View{}, fault.Wrap(fault.Internal, "清空对话失败", err)
	}
	if err := service.repository.ClearConversation(ctx, userID, conversationUUID, replacementUUID); err != nil {
		if errors.Is(err, ErrNoLongerMutable) {
			return View{}, fault.New(fault.Conflict, "对话已结束，不能清空")
		}
		return View{}, fault.Wrap(fault.Internal, "清空对话失败", err)
	}
	return service.GetConversation(ctx, userID, replacementUUID)
}

// FinalizeCompletionConversation 结束完成审查对话，生成并保存唯一的完整验收结论。
func (service *Service) FinalizeCompletionConversation(ctx context.Context, userID uint64, input FinalizeCompletionInput) (View, error) {
	input.ConversationUUID = strings.TrimSpace(input.ConversationUUID)
	if input.ConversationUUID == "" {
		return View{}, fault.New(fault.InvalidRequest, "缺少对话 UUID")
	}
	if input.StartedAt != nil && input.EndedAt != nil && input.EndedAt.Before(*input.StartedAt) {
		return View{}, fault.New(fault.InvalidRequest, "结束时间不能早于开始时间")
	}
	conversation, err := service.GetConversation(ctx, userID, input.ConversationUUID)
	if err != nil {
		return View{}, err
	}
	if conversation.Phase != "completion" {
		return View{}, fault.New(fault.InvalidRequest, "只有完成审查对话可以生成最终结论")
	}
	if conversation.Status == "closed" {
		return View{}, fault.New(fault.Conflict, "完成审查已经生成最终结论")
	}
	if !hasUserMessage(conversation.Messages) {
		return View{}, fault.New(fault.InvalidRequest, "请先说明这次实际做了什么")
	}
	configuration, keyID, err := service.projectConfiguration(ctx, userID, conversation.ProjectID)
	if err != nil {
		return View{}, err
	}
	output, err := service.requestCompletionConversationConclusion(ctx, configuration.Credential, conversation)
	if err != nil {
		return View{}, fault.Wrap(fault.UpstreamFailure, err.Error(), err)
	}
	if strings.TrimSpace(output.Reply) == "" {
		output.Reply = output.Review.Summary
	}
	review, err := service.reviewer.NormalizeCompletion(reviewRequestFromConversation(conversation), output.Review)
	if err != nil {
		return View{}, fault.Wrap(fault.Internal, "生成审查编号失败", err)
	}
	review.AIConfig = configuration.Snapshot
	if conversation.NodeID == nil {
		return View{}, fault.New(fault.Conflict, "节点已锁定或审查对话已结束，不能生成最终结论")
	}
	round := applicationreview.Round{ID: review.ID, Kind: "initial", Review: review, AIConfig: review.AIConfig, CreatedAt: review.CreatedAt}
	reviewJSON, err := marshal(review)
	if err != nil {
		return View{}, fault.Wrap(fault.Internal, "保存审查结果失败", err)
	}
	roundsJSON, err := marshal([]applicationreview.Round{round})
	if err != nil {
		return View{}, fault.Wrap(fault.Internal, "保存审查结果失败", err)
	}
	messagesJSON, err := marshal(conversationToReviewMessages(conversation.Messages, output.Reply))
	if err != nil {
		return View{}, fault.Wrap(fault.Internal, "保存审查结果失败", err)
	}
	payloadJSON, err := marshal(output)
	if err != nil {
		return View{}, fault.Wrap(fault.Internal, "保存审查结果失败", err)
	}
	configJSON, err := marshal(configuration.Snapshot)
	if err != nil {
		return View{}, fault.Wrap(fault.Internal, "保存审查结果失败", err)
	}
	messageID, err := sharedid.UUID()
	if err != nil {
		return View{}, fault.Wrap(fault.Internal, "保存审查结果失败", err)
	}
	claim := userMessageText(conversation.Messages)
	stage := "needs_supplement"
	if review.Verdict == "pass" {
		stage = "verified"
	}
	if err := service.credentials.MarkAIKeyUsed(ctx, userID, keyID); err != nil {
		return View{}, fault.Wrap(fault.Internal, "保存 AI 使用记录失败", err)
	}
	err = service.repository.PersistCompletionReview(ctx, CompletionReviewSave{
		UserID: userID, ConversationID: input.ConversationUUID, NodeID: *conversation.NodeID,
		Claim: claim, Evidence: claim, StartedAt: input.StartedAt, EndedAt: input.EndedAt,
		Stage: stage, ReviewJSON: reviewJSON, RoundsJSON: roundsJSON, ConfigJSON: configJSON,
		MessagesJSON: messagesJSON, PayloadJSON: payloadJSON, Reply: output.Reply, MessageID: messageID,
	})
	if errors.Is(err, ErrNoLongerMutable) {
		return View{}, fault.New(fault.Conflict, "节点已锁定或审查对话已结束，最终结论未写入")
	}
	if err != nil {
		return View{}, fault.Wrap(fault.Internal, "保存审查结果失败", err)
	}
	return service.GetConversation(ctx, userID, input.ConversationUUID)
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
		if err := service.processCompletionMessage(ctx, userID, conversationUUID, conversation, configuration, keyID); err != nil {
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
	if output.ReadyForFreeze || (freezeReview && isQuickActionContext(conversation.Context) && planningDraftReady(output.Draft)) {
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

func (service *Service) processCompletionMessage(ctx context.Context, userID uint64, conversationUUID string, conversation View, configuration applicationreview.ModelConfiguration, keyID string) error {
	output, err := service.requestCompletionConversationReply(ctx, configuration.Credential, conversation)
	if err != nil {
		return fault.Wrap(fault.UpstreamFailure, err.Error(), err)
	}
	if strings.TrimSpace(output.Reply) == "" {
		output.Reply = "我已记录这部分说明。你可以继续补充，或准备生成最终结论。"
	}
	messageID, err := sharedid.UUID()
	if err != nil {
		return fault.Wrap(fault.Internal, "保存 AI 回复失败", err)
	}
	payloadJSON, err := marshal(output)
	if err != nil {
		return fault.Wrap(fault.Internal, "保存 AI 回复失败", err)
	}
	configJSON, err := marshal(configuration.Snapshot)
	if err != nil {
		return fault.Wrap(fault.Internal, "保存 AI 回复失败", err)
	}
	if err := service.credentials.MarkAIKeyUsed(ctx, userID, keyID); err != nil {
		return fault.Wrap(fault.Internal, "保存 AI 使用记录失败", err)
	}
	err = service.repository.AddAssistantMessage(ctx, messageID, userID, conversationUUID, output.Reply, payloadJSON, configJSON)
	if errors.Is(err, ErrNoLongerMutable) {
		return fault.New(fault.Conflict, "对话已结束，本轮 AI 回复未写入")
	}
	if err != nil {
		return fault.Wrap(fault.Internal, "保存 AI 回复失败", err)
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
		Project       applicationreview.Project       `json:"project"`
		SmartContract applicationreview.SmartContract `json:"smartContract"`
		Node          struct {
			Title               string                        `json:"title"`
			VerifiableGoal      string                        `json:"verifiableGoal"`
			AcceptanceCriteria  []applicationreview.Criterion `json:"acceptanceCriteria"`
			EvidenceRequirement string                        `json:"evidenceRequirement"`
		} `json:"node"`
	}
	_ = json.Unmarshal(contextBytes, &contextData)
	request.Project = contextData.Project
	request.SmartContract = contextData.SmartContract
	if conversation.NodeID != nil {
		request.NodeID = *conversation.NodeID
	}
	request.Title = contextData.Node.Title
	request.VerifiableGoal = contextData.Node.VerifiableGoal
	request.AcceptanceCriteria = contextData.Node.AcceptanceCriteria
	request.EvidenceRequirement = contextData.Node.EvidenceRequirement
	return request
}

func hasUserMessage(messages []MessageView) bool {
	for _, message := range messages {
		if message.Role == "user" && strings.TrimSpace(message.Body) != "" {
			return true
		}
	}
	return false
}

func userMessageText(messages []MessageView) string {
	parts := make([]string, 0, len(messages))
	for _, message := range messages {
		if message.Role == "user" && strings.TrimSpace(message.Body) != "" {
			parts = append(parts, strings.TrimSpace(message.Body))
		}
	}
	return strings.Join(parts, "\n\n")
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

func isQuickActionContext(value any) bool {
	bytes, err := json.Marshal(value)
	if err != nil {
		return false
	}
	var contextValue struct {
		SmartContract struct {
			ID string `json:"uuid"`
		} `json:"smartContract"`
	}
	if json.Unmarshal(bytes, &contextValue) != nil {
		return false
	}
	return contextValue.SmartContract.ID == sharedconstants.QuickActionSmartContractID
}

func planningDraftReady(draft ActionDraft) bool {
	return strings.TrimSpace(draft.Title) != "" && strings.TrimSpace(draft.VerifiableGoal) != "" && len(trimCriteria(draft.AcceptanceCriteria, true)) > 0
}

func trimCriteria(criteria []string, quickAction bool) []string {
	result := make([]string, 0, len(criteria))
	limit := len(criteria)
	if quickAction && limit > 3 {
		limit = 3
	}
	for _, criterion := range criteria[:limit] {
		if value := strings.TrimSpace(criterion); value != "" {
			result = append(result, value)
		}
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
