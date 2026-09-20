package review

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	applicationaigateway "github.com/singaurora/exec-graph/backend/internal/application/aigateway"
	applicationaikey "github.com/singaurora/exec-graph/backend/internal/application/aikey"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
	sharedid "github.com/singaurora/exec-graph/backend/internal/shared/id"
)

type closureScopeNode struct {
	ID                  string
	Title               string
	VerifiableGoal      string
	AcceptanceCriteria  []Criterion
	EvidenceRequirement string
}

// SubmitCompletion 审查并保存节点的首次完成提交。
func (service *Service) SubmitCompletion(ctx context.Context, userID uint64, input CompletionRequest) (Result, error) {
	input.NodeID = strings.TrimSpace(input.NodeID)
	input.CompletionClaim = strings.TrimSpace(input.CompletionClaim)
	input.EvidenceText = strings.TrimSpace(input.EvidenceText)
	if input.NodeID == "" || input.CompletionClaim == "" || input.EvidenceText == "" {
		return Result{}, fault.New(fault.InvalidRequest, "请提交节点编号、推进结果和逐条证据")
	}
	if input.StartedAt != nil && input.EndedAt != nil && input.EndedAt.Before(*input.StartedAt) {
		return Result{}, fault.New(fault.InvalidRequest, "结束时间不能早于开始时间")
	}

	request, messages, err := service.loadInitialRequest(ctx, userID, input)
	if err != nil {
		return Result{}, err
	}
	configuration, keyID, err := service.projectConfiguration(ctx, userID, request.Project.ID)
	if err != nil {
		return Result{}, err
	}
	review, err := service.ReviewCompletion(ctx, configuration, request)
	if err != nil {
		return Result{}, fault.Wrap(fault.UpstreamFailure, err.Error(), err)
	}
	round := Round{ID: review.ID, Kind: "initial", Review: review, AIConfig: review.AIConfig, CreatedAt: review.CreatedAt}
	updatedMessages, err := appendReviewMessages(messages,
		ReviewMessage{Speaker: "user", Body: input.CompletionClaim, CreatedAt: time.Now()},
		ReviewMessage{Speaker: "ai", Body: review.Summary, CreatedAt: review.CreatedAt},
	)
	if err != nil {
		return Result{}, fault.Wrap(fault.Internal, "保存 AI 审查失败", err)
	}
	reviewJSON, roundsJSON, messagesJSON, configJSON, err := encodeReviewState(review, []Round{round}, updatedMessages)
	if err != nil {
		return Result{}, fault.Wrap(fault.Internal, "保存 AI 审查失败", err)
	}
	if err := service.credentials.MarkAIKeyUsed(ctx, userID, keyID); err != nil {
		return Result{}, fault.Wrap(fault.Internal, "保存 AI 使用记录失败", err)
	}
	updated, err := service.repository.SaveInitialReview(ctx, InitialReviewSave{
		UserID: userID, NodeID: input.NodeID, CompletionClaim: input.CompletionClaim, EvidenceText: input.EvidenceText,
		StartedAt: input.StartedAt, EndedAt: input.EndedAt, Stage: reviewStage(review), ReviewJSON: reviewJSON,
		AIConfigJSON: configJSON, RoundsJSON: roundsJSON, MessagesJSON: messagesJSON,
	})
	if err != nil {
		return Result{}, fault.Wrap(fault.Internal, "保存 AI 审查结果失败", err)
	}
	if !updated {
		return Result{}, fault.New(fault.Conflict, "节点状态已经变化，请刷新后重试")
	}
	return review, nil
}

// ReviewClarification 使用用户补充的既有证据重新审查节点。
func (service *Service) ReviewClarification(ctx context.Context, userID uint64, input ClarificationInput) (Result, error) {
	input = normalizeClarification(input)
	if input.NodeID == "" || len(input.CriterionIDs) == 0 || (len([]rune(input.Explanation)) < 4 && len([]rune(input.EvidenceAddition)) < 20) {
		return Result{}, fault.New(fault.InvalidRequest, "请选择需复审的验收标准，并补充说明或提交前已存在的证据")
	}
	if input.EvidenceAddition != "" && !input.EvidencePredatesSubmission {
		return Result{}, fault.New(fault.InvalidRequest, "请确认补交材料在首次提交前已经存在")
	}

	request, messages, rounds, err := service.loadClarificationRequest(ctx, userID, input)
	if err != nil {
		return Result{}, err
	}
	configuration, keyID, err := service.projectConfiguration(ctx, userID, request.Project.ID)
	if err != nil {
		return Result{}, err
	}
	review, err := service.ReviewCompletion(ctx, configuration, request)
	if err != nil {
		return Result{}, fault.Wrap(fault.UpstreamFailure, err.Error(), err)
	}
	rounds = append(rounds, Round{ID: review.ID, Kind: "clarification", Clarification: request.Clarification, Review: review, AIConfig: review.AIConfig, CreatedAt: review.CreatedAt})
	updatedMessages, err := appendReviewMessages(messages,
		ReviewMessage{Speaker: "user", Body: clarificationMessage(input), CreatedAt: time.Now()},
		ReviewMessage{Speaker: "ai", Body: review.Summary, CreatedAt: review.CreatedAt},
	)
	if err != nil {
		return Result{}, fault.Wrap(fault.Internal, "保存 AI 审查失败", err)
	}
	reviewJSON, roundsJSON, messagesJSON, configJSON, err := encodeReviewState(review, rounds, updatedMessages)
	if err != nil {
		return Result{}, fault.Wrap(fault.Internal, "保存 AI 审查失败", err)
	}
	if err := service.credentials.MarkAIKeyUsed(ctx, userID, keyID); err != nil {
		return Result{}, fault.Wrap(fault.Internal, "保存 AI 使用记录失败", err)
	}
	updated, err := service.repository.SaveClarificationReview(ctx, ClarificationReviewSave{
		NodeID: input.NodeID, Stage: reviewStage(review), ReviewJSON: reviewJSON,
		AIConfigJSON: configJSON, RoundsJSON: roundsJSON, MessagesJSON: messagesJSON,
	})
	if err != nil {
		return Result{}, fault.Wrap(fault.Internal, "保存补充审查结果失败", err)
	}
	if !updated {
		return Result{}, fault.New(fault.Conflict, "节点状态已经变化，请刷新后重试")
	}
	return review, nil
}

// ReviewProjectDraft 审查项目中的规划草案并记录所用 AI。
func (service *Service) ReviewProjectDraft(ctx context.Context, userID uint64, request DraftRequest) (DraftResult, error) {
	if err := validateDraftRequest(request); err != nil {
		return DraftResult{}, fault.New(fault.InvalidRequest, err.Error())
	}
	configuration, keyID, err := service.projectConfiguration(ctx, userID, request.Project.ID)
	if err != nil {
		return DraftResult{}, err
	}
	review, err := service.ReviewDraft(ctx, configuration, request)
	if err != nil {
		return DraftResult{}, fault.Wrap(fault.UpstreamFailure, err.Error(), err)
	}
	if err := service.credentials.MarkAIKeyUsed(ctx, userID, keyID); err != nil {
		return DraftResult{}, fault.Wrap(fault.Internal, "保存 AI 使用记录失败", err)
	}
	return review, nil
}

func (service *Service) loadInitialRequest(ctx context.Context, userID uint64, input CompletionRequest) (CompletionRequest, string, error) {
	value, err := service.repository.LoadNodeReviewContext(ctx, userID, input.NodeID)
	if err != nil {
		return CompletionRequest{}, "", mapLoadError(err)
	}
	if value.ArchivedAt != nil {
		return CompletionRequest{}, "", fault.New(fault.InvalidRequest, "项目已归档，不能提交审查")
	}
	if value.Stage != "frozen" {
		return CompletionRequest{}, "", fault.New(fault.Conflict, "当前节点不能重复提交审查")
	}
	if !value.IsCurrent {
		return CompletionRequest{}, "", fault.New(fault.Conflict, "该节点不是当前待推进节点")
	}
	request, err := completionRequestFromContext(value)
	if err != nil {
		return CompletionRequest{}, "", fault.New(fault.InvalidRequest, err.Error())
	}
	request.CompletionClaim, request.EvidenceText = input.CompletionClaim, input.EvidenceText
	request.StartedAt, request.EndedAt = input.StartedAt, input.EndedAt
	if err := service.expandCompletionScope(ctx, &request); err != nil {
		return CompletionRequest{}, "", fault.Wrap(fault.Internal, "读取收束范围失败", err)
	}
	if err := validateCompletionRequest(request); err != nil {
		return CompletionRequest{}, "", fault.New(fault.InvalidRequest, err.Error())
	}
	return request, value.MessagesJSON, nil
}

func (service *Service) loadClarificationRequest(ctx context.Context, userID uint64, input ClarificationInput) (CompletionRequest, string, []Round, error) {
	value, err := service.repository.LoadNodeReviewContext(ctx, userID, input.NodeID)
	if err != nil {
		return CompletionRequest{}, "", nil, mapLoadError(err)
	}
	if value.ArchivedAt != nil {
		return CompletionRequest{}, "", nil, fault.New(fault.InvalidRequest, "项目已归档，不能补充审查")
	}
	if value.Stage != "verified" && value.Stage != "needs_supplement" {
		return CompletionRequest{}, "", nil, fault.New(fault.Conflict, "当前节点没有可澄清的 AI 审查结果")
	}
	if !value.IsCurrent {
		return CompletionRequest{}, "", nil, fault.New(fault.Conflict, "该节点不是当前待确认节点")
	}
	request, err := completionRequestFromContext(value)
	if err != nil {
		return CompletionRequest{}, "", nil, fault.New(fault.InvalidRequest, err.Error())
	}
	knownCriteria := make(map[string]struct{}, len(request.AcceptanceCriteria))
	for _, criterion := range request.AcceptanceCriteria {
		knownCriteria[criterion.ID] = struct{}{}
	}
	for _, criterionID := range input.CriterionIDs {
		if _, ok := knownCriteria[criterionID]; !ok {
			return CompletionRequest{}, "", nil, fault.New(fault.InvalidRequest, "选择的验收标准不存在")
		}
	}
	if value.Claim == nil || value.Evidence == nil || value.ReviewJSON == nil || strings.TrimSpace(*value.Claim) == "" || strings.TrimSpace(*value.Evidence) == "" || strings.TrimSpace(*value.ReviewJSON) == "" {
		return CompletionRequest{}, "", nil, fault.New(fault.InvalidRequest, "原始提交或 AI 审查记录不存在，不能补充审查")
	}
	request.CompletionClaim, request.EvidenceText = *value.Claim, *value.Evidence
	if err := json.Unmarshal([]byte(*value.ReviewJSON), &request.PriorReview); err != nil || request.PriorReview == nil {
		return CompletionRequest{}, "", nil, fault.New(fault.InvalidRequest, "上一轮 AI 审查记录已损坏")
	}
	clarificationID, err := sharedid.UUID()
	if err != nil {
		return CompletionRequest{}, "", nil, fault.Wrap(fault.Internal, "生成澄清编号失败", err)
	}
	request.Clarification = &Clarification{
		ID: clarificationID, CriterionIDs: input.CriterionIDs, Explanation: input.Explanation,
		EvidenceReferences: input.EvidenceReferences, EvidenceAddition: input.EvidenceAddition,
		EvidencePredatesSubmission: input.EvidencePredatesSubmission, CreatedAt: time.Now(),
	}
	if err := service.expandCompletionScope(ctx, &request); err != nil {
		return CompletionRequest{}, "", nil, fault.Wrap(fault.Internal, "读取收束范围失败", err)
	}
	if err := validateCompletionRequest(request); err != nil {
		return CompletionRequest{}, "", nil, fault.New(fault.InvalidRequest, err.Error())
	}
	rounds, err := decodePriorRounds(value, request.PriorReview)
	if err != nil {
		return CompletionRequest{}, "", nil, fault.New(fault.InvalidRequest, "审查轮次记录已损坏")
	}
	return request, value.MessagesJSON, rounds, nil
}

func completionRequestFromContext(value NodeReviewContext) (CompletionRequest, error) {
	request := CompletionRequest{
		Project:       Project{ID: value.ProjectID, Title: value.ProjectTitle, Description: value.ProjectDescription, ProjectRules: value.ProjectRules},
		SmartContract: SmartContract{ID: value.SmartContractID, Name: value.SmartContractName, Description: value.SmartContractDescription, Body: value.SmartContractBody},
		NodeID:        value.NodeID, Title: value.Title, OriginalIntent: value.OriginalIntent,
		VerifiableGoal: value.Goal, EvidenceRequirement: value.EvidenceRequirement,
	}
	if err := json.Unmarshal([]byte(value.CriteriaJSON), &request.AcceptanceCriteria); err != nil {
		return CompletionRequest{}, fmt.Errorf("节点验收标准已损坏")
	}
	return request, nil
}

func (service *Service) expandCompletionScope(ctx context.Context, request *CompletionRequest) error {
	closureNodes, err := service.loadClosureScope(ctx, request.Project.ID, request.NodeID)
	if err != nil || len(closureNodes) == 0 {
		return err
	}
	current := closureScopeNode{ID: request.NodeID, Title: request.Title, VerifiableGoal: request.VerifiableGoal, AcceptanceCriteria: request.AcceptanceCriteria, EvidenceRequirement: request.EvidenceRequirement}
	scope := append(closureNodes, current)
	criteria := make([]Criterion, 0)
	goals := make([]string, 0, len(scope))
	evidence := make([]string, 0, len(scope))
	for _, node := range scope {
		goals = append(goals, fmt.Sprintf("%s：%s", node.Title, node.VerifiableGoal))
		evidence = append(evidence, fmt.Sprintf("%s：%s", node.Title, node.EvidenceRequirement))
		for _, criterion := range node.AcceptanceCriteria {
			criteria = append(criteria, Criterion{ID: fmt.Sprintf("%s::%s", node.ID, criterion.ID), Text: fmt.Sprintf("[%s] %s", node.Title, criterion.Text), RequiredEvidence: criterion.RequiredEvidence})
		}
	}
	request.Title = fmt.Sprintf("收束推进：%s", current.Title)
	request.OriginalIntent = "这次提交会收束此前未闭合的推进节点与当前补齐节点；必须逐项核验整个收束范围。"
	request.VerifiableGoal = strings.Join(goals, "\n")
	request.AcceptanceCriteria = criteria
	request.EvidenceRequirement = strings.Join(evidence, "\n")
	return nil
}

func (service *Service) loadClosureScope(ctx context.Context, projectUUID, targetNodeUUID string) ([]closureScopeNode, error) {
	queue := []string{targetNodeUUID}
	visited := map[string]struct{}{targetNodeUUID: {}}
	result := make([]closureScopeNode, 0)
	for len(queue) > 0 {
		target := queue[0]
		queue = queue[1:]
		sourceIDs, err := service.repository.ListClosureSourceUUIDs(ctx, target)
		if err != nil {
			return nil, err
		}
		for _, sourceID := range sourceIDs {
			if _, seen := visited[sourceID]; seen {
				continue
			}
			visited[sourceID] = struct{}{}
			stored, err := service.repository.LoadClosureSource(ctx, sourceID, projectUUID)
			if err != nil {
				return nil, err
			}
			node := closureScopeNode{ID: stored.ID, Title: stored.Title, VerifiableGoal: stored.Goal, EvidenceRequirement: stored.Evidence}
			if err := json.Unmarshal([]byte(stored.Criteria), &node.AcceptanceCriteria); err != nil {
				return nil, err
			}
			result = append(result, node)
			queue = append(queue, sourceID)
		}
	}
	return result, nil
}

func (service *Service) projectConfiguration(ctx context.Context, userID uint64, projectUUID string) (ModelConfiguration, string, error) {
	key, err := service.credentials.FindProjectReviewKey(ctx, userID, projectUUID)
	if errors.Is(err, applicationaikey.ErrNotFound) {
		return ModelConfiguration{}, "", fault.New(fault.InvalidRequest, "请先为项目选择审查 AI")
	}
	if err != nil {
		return ModelConfiguration{}, "", fault.Wrap(fault.Internal, "读取项目审查 AI 失败", err)
	}
	configuration := ModelConfiguration{
		Credential: applicationaigateway.Credential{Provider: key.Provider, APIKey: key.Secret, BaseURL: key.BaseURL, Model: key.Model},
		Snapshot:   AIConfigSnapshot{KeyID: key.ID, Label: key.Label, Provider: key.Provider, Model: key.Model, BaseURL: key.BaseURL},
	}
	return configuration, key.ID, nil
}

func validateCompletionRequest(request CompletionRequest) error {
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

func validateDraftRequest(request DraftRequest) error {
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

func normalizeClarification(input ClarificationInput) ClarificationInput {
	input.NodeID = strings.TrimSpace(input.NodeID)
	input.Explanation = strings.TrimSpace(input.Explanation)
	input.EvidenceReferences = strings.TrimSpace(input.EvidenceReferences)
	input.EvidenceAddition = strings.TrimSpace(input.EvidenceAddition)
	seen := make(map[string]struct{}, len(input.CriterionIDs))
	criteria := make([]string, 0, len(input.CriterionIDs))
	for _, value := range input.CriterionIDs {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		criteria = append(criteria, value)
	}
	input.CriterionIDs = criteria
	return input
}

func decodePriorRounds(value NodeReviewContext, prior *Result) ([]Round, error) {
	var rounds []Round
	if value.ReviewRoundsJSON != nil && strings.TrimSpace(*value.ReviewRoundsJSON) != "" {
		if err := json.Unmarshal([]byte(*value.ReviewRoundsJSON), &rounds); err != nil {
			return nil, err
		}
	}
	if len(rounds) == 0 {
		configuration := prior.AIConfig
		if value.ReviewConfigJSON != nil && strings.TrimSpace(*value.ReviewConfigJSON) != "" {
			_ = json.Unmarshal([]byte(*value.ReviewConfigJSON), &configuration)
		}
		rounds = append(rounds, Round{ID: prior.ID, Kind: "initial", Review: *prior, AIConfig: configuration, CreatedAt: prior.CreatedAt})
	}
	return rounds, nil
}

func appendReviewMessages(raw string, additions ...ReviewMessage) ([]ReviewMessage, error) {
	messages := make([]ReviewMessage, 0)
	if strings.TrimSpace(raw) != "" {
		if err := json.Unmarshal([]byte(raw), &messages); err != nil {
			return nil, err
		}
	}
	for index := range additions {
		id, err := sharedid.UUID()
		if err != nil {
			return nil, err
		}
		additions[index].ID = id
		messages = append(messages, additions[index])
	}
	return messages, nil
}

func encodeReviewState(review Result, rounds []Round, messages []ReviewMessage) (string, string, string, string, error) {
	values := []any{review, rounds, messages, review.AIConfig}
	encoded := make([]string, len(values))
	for index, value := range values {
		bytes, err := json.Marshal(value)
		if err != nil {
			return "", "", "", "", err
		}
		encoded[index] = string(bytes)
	}
	return encoded[0], encoded[1], encoded[2], encoded[3], nil
}

func clarificationMessage(input ClarificationInput) string {
	body := fmt.Sprintf("审查补充（%s）", strings.Join(input.CriterionIDs, "、"))
	if input.Explanation != "" {
		body += "：" + input.Explanation
	}
	if input.EvidenceReferences != "" {
		body += "\n证据位置：" + input.EvidenceReferences
	}
	if input.EvidenceAddition != "" {
		body += "\n\n补交的既有证据（用户声明：首次提交前已存在）：\n" + input.EvidenceAddition
	}
	return body
}

func reviewStage(review Result) string {
	if review.Verdict == "pass" {
		return "verified"
	}
	return "needs_supplement"
}

func mapLoadError(err error) error {
	if errors.Is(err, ErrNotFound) {
		return fault.Wrap(fault.NotFound, "节点不存在", err)
	}
	return fault.Wrap(fault.Internal, "读取节点审查上下文失败", err)
}
