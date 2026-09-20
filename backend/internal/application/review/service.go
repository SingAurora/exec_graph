// Package review implements AI-backed execution contract review rules.
package review

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	applicationaigateway "github.com/singaurora/exec-graph/backend/internal/application/aigateway"
	sharedid "github.com/singaurora/exec-graph/backend/internal/shared/id"
)

type Service struct {
	modelClient applicationaigateway.Client
	repository  Repository
	credentials CredentialProvider
}

// New 创建审查应用服务。
func New(dependencies Dependencies) *Service {
	return &Service{
		modelClient: dependencies.ModelClient,
		repository:  dependencies.Repository,
		credentials: dependencies.Credentials,
	}
}

func (service *Service) ReviewCompletion(ctx context.Context, config ModelConfiguration, request CompletionRequest) (Result, error) {
	output, err := service.requestCompletion(ctx, config.Credential, request)
	if err != nil {
		return Result{}, err
	}
	result, err := service.NormalizeCompletion(request, output)
	result.AIConfig = config.Snapshot
	return result, err
}

func (service *Service) ReviewDraft(ctx context.Context, config ModelConfiguration, request DraftRequest) (DraftResult, error) {
	system, user, err := draftPrompt(request)
	if err != nil {
		return DraftResult{}, fmt.Errorf("节点草案审核请求生成失败")
	}
	content, err := service.modelClient.GenerateContent(ctx, applicationaigateway.GenerateInput{Credential: config.Credential, System: system, User: user, MaxTokens: 900, JSONMode: true})
	if err != nil {
		return DraftResult{}, err
	}
	var output DraftModelOutput
	if err := json.Unmarshal([]byte(applicationaigateway.ExtractJSONObject(content)), &output); err != nil {
		return DraftResult{}, fmt.Errorf("节点草案审核结果不是可解析的 JSON")
	}
	result, err := normalizeDraft(output)
	result.AIConfig = config.Snapshot
	return result, err
}

func (service *Service) requestCompletion(ctx context.Context, credential applicationaigateway.Credential, request CompletionRequest) (ModelOutput, error) {
	system, user, err := completionPrompt(request)
	if err != nil {
		return ModelOutput{}, fmt.Errorf("AI 审查请求生成失败")
	}
	content, err := service.modelClient.GenerateContent(ctx, applicationaigateway.GenerateInput{Credential: credential, System: system, User: user, MaxTokens: 8192, JSONMode: true})
	if err != nil {
		var reasoningOnly applicationaigateway.ReasoningOnlyError
		if errors.As(err, &reasoningOnly) {
			return service.finalizeCompletion(ctx, credential, request, reasoningOnly.Reasoning)
		}
		return ModelOutput{}, err
	}
	var output ModelOutput
	if err := json.Unmarshal([]byte(applicationaigateway.ExtractJSONObject(content)), &output); err != nil {
		return ModelOutput{}, fmt.Errorf("AI 审查结果不是可解析的 JSON")
	}
	return output, nil
}

func (service *Service) finalizeCompletion(ctx context.Context, credential applicationaigateway.Credential, request CompletionRequest, reasoning string) (ModelOutput, error) {
	system, user, err := finalizationPrompt(request, reasoning)
	if err != nil {
		return ModelOutput{}, fmt.Errorf("AI 审查结论恢复请求生成失败")
	}
	content, err := service.modelClient.GenerateContent(ctx, applicationaigateway.GenerateInput{Credential: credential, System: system, User: user, MaxTokens: 4096, JSONMode: true})
	if err != nil {
		return ModelOutput{}, fmt.Errorf("AI 只返回了推理过程，未生成最终审查结论；已自动重试一次，请改用可直接输出结果的模型，例如 deepseek-chat")
	}
	var output ModelOutput
	if err := json.Unmarshal([]byte(applicationaigateway.ExtractJSONObject(content)), &output); err != nil {
		return ModelOutput{}, fmt.Errorf("AI 补全的审查结论不是可解析的 JSON")
	}
	return output, nil
}

func (service *Service) NormalizeCompletion(request CompletionRequest, output ModelOutput) (Result, error) {
	id, err := sharedid.UUID()
	if err != nil {
		return Result{}, fmt.Errorf("生成审查编号失败")
	}
	return normalizeCompletion(id, time.Now(), request, output), nil
}

func normalizeDraft(output DraftModelOutput) (DraftResult, error) {
	id, err := sharedid.UUID()
	if err != nil {
		return DraftResult{}, fmt.Errorf("生成节点草案审核编号失败")
	}
	verdict := strings.TrimSpace(output.Verdict)
	if verdict != "pass" && verdict != "fail" {
		verdict = "fail"
	}
	missing := make([]string, 0, len(output.MissingRequirements))
	for _, requirement := range output.MissingRequirements {
		if value := strings.TrimSpace(requirement); value != "" {
			missing = append(missing, value)
		}
	}
	if verdict == "fail" && len(missing) == 0 {
		missing = append(missing, "请补充可验证目标、验收标准或证据要求。")
	}
	if verdict == "pass" {
		missing = []string{}
	}
	summary := strings.TrimSpace(output.Summary)
	if summary == "" && verdict == "pass" {
		summary = "节点草案审核通过。这个推进节点符合项目规则，可以冻结。"
	} else if summary == "" {
		summary = "节点草案审核未通过。当前描述还不足以支撑后续完成审查。"
	}
	return DraftResult{ID: id, Verdict: verdict, Summary: summary, MissingRequirements: missing, CreatedAt: time.Now()}, nil
}

func normalizeCompletion(id string, createdAt time.Time, request CompletionRequest, output ModelOutput) Result {
	validResults := map[string]bool{"met": true, "unclear": true, "unmet": true}
	byCriterion := make(map[string]CriterionResult, len(output.CriterionReviews))
	for _, review := range output.CriterionReviews {
		criterionID, result, reason := strings.TrimSpace(review.CriterionID), strings.TrimSpace(review.Result), strings.TrimSpace(review.Reason)
		if !validResults[result] {
			result = "unclear"
		}
		if reason == "" {
			reason = "AI 没有给出明确理由，暂按证据不足处理。"
		}
		if criterionID != "" {
			byCriterion[criterionID] = CriterionResult{CriterionID: criterionID, Result: result, Reason: reason}
		}
	}
	reviews := make([]CriterionResult, 0, len(request.AcceptanceCriteria))
	metCount := 0
	for _, criterion := range request.AcceptanceCriteria {
		review, ok := byCriterion[criterion.ID]
		if !ok {
			review = CriterionResult{CriterionID: criterion.ID, Result: "unclear", Reason: "AI 没有覆盖这条验收标准，暂按证据不足处理。"}
		}
		if review.Result == "met" {
			metCount++
		}
		reviews = append(reviews, review)
	}
	verdict := strings.TrimSpace(output.Verdict)
	if verdict != "pass" && verdict != "partial" && verdict != "fail" {
		if metCount == len(request.AcceptanceCriteria) {
			verdict = "pass"
		} else if metCount > 0 {
			verdict = "partial"
		} else {
			verdict = "fail"
		}
	}
	if verdict == "pass" {
		for _, review := range reviews {
			if review.Result != "met" {
				verdict = "partial"
				break
			}
		}
	}
	summary := strings.TrimSpace(output.Summary)
	if summary == "" && verdict == "pass" {
		summary = "智能合约审查通过。这次推进满足冻结验收标准，等待用户确认后锁定。"
	} else if summary == "" {
		summary = "智能合约审查未通过。当前证据仍有缺口，可以继续补足或带着该结论锁定。"
	}
	supplementTitle := strings.TrimSpace(output.SuggestedSupplementTitle)
	if verdict != "pass" && supplementTitle == "" {
		supplementTitle = fmt.Sprintf("补齐「%s」", firstUnmetCriterionTitle(request.AcceptanceCriteria, reviews, request.Title))
	}
	if verdict == "pass" {
		supplementTitle = ""
	}
	return Result{ID: id, Verdict: verdict, Summary: summary, CriterionReviews: reviews, SuggestedSupplementTitle: supplementTitle, CreatedAt: createdAt}
}

func firstUnmetCriterionTitle(criteria []Criterion, reviews []CriterionResult, fallback string) string {
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
