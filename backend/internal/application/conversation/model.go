package conversation

import (
	"context"
	"encoding/json"
	"strings"

	applicationaigateway "github.com/singaurora/exec-graph/backend/internal/application/aigateway"
	applicationreview "github.com/singaurora/exec-graph/backend/internal/application/review"
)

func (service *Service) requestPlanningConversation(ctx context.Context, credential applicationaigateway.Credential, conversation View, freezeReview bool) (planningConversationOutput, error) {
	var output planningConversationOutput
	system := "你是 ExecG 的行动规划协作者。通过多轮中文对话把用户模糊想法收敛为一次真实、可执行的推进。草案必须有标题、目标、做到位清单和记录要求。不要假装用户已经完成，也不要承诺 AI 能证明现实结果。规则引导型项目必须遵从项目规则；其他项目只帮助澄清。回应友好、简洁，指出下一步需要补什么。只返回 JSON。"
	if freezeReview {
		system += "当前用户明确请求保存为推进。只有草案完整且每条做到位清单可独立观察时，readyForFreezeReview 才能为 true。"
	}
	payload := struct {
		Context              any                        `json:"context"`
		CurrentDraft         *ActionDraft               `json:"currentDraft"`
		Messages             []MessageView              `json:"messages"`
		RequiredJSONResponse planningConversationOutput `json:"requiredJSONResponse"`
	}{Context: conversation.Context, CurrentDraft: conversation.CurrentDraft, Messages: conversation.Messages, RequiredJSONResponse: planningConversationOutput{Reply: "中文回复", Draft: ActionDraft{}, ReadyForFreeze: false}}
	if err := service.callModel(ctx, credential, system, payload, &output); err != nil {
		return output, err
	}
	output.Draft.Title = strings.TrimSpace(output.Draft.Title)
	output.Draft.VerifiableGoal = strings.TrimSpace(output.Draft.VerifiableGoal)
	output.Draft.EvidenceRequirement = strings.TrimSpace(output.Draft.EvidenceRequirement)
	return output, nil
}

func (service *Service) requestCompletionConversation(ctx context.Context, credential applicationaigateway.Credential, conversation View) (completionConversationOutput, error) {
	var output completionConversationOutput
	system := "你是 ExecG 的行动记录辅助者。对话围绕已经保存的行动规则展开，逐轮检查用户提交的行动记录和解释。不能修改目标、做到位清单或记录要求，不能把计划补写成已经发生；发现新工作应指出需要另建下一步行动。每次都逐条说明当前记录覆盖了什么、哪些仍需观察。只返回 JSON。"
	payload := struct {
		Context              any                          `json:"context"`
		Messages             []MessageView                `json:"messages"`
		RequiredJSONResponse completionConversationOutput `json:"requiredJSONResponse"`
	}{Context: conversation.Context, Messages: conversation.Messages, RequiredJSONResponse: completionConversationOutput{Reply: "中文回复", Review: applicationreview.ModelOutput{Verdict: "pass|partial|fail", Summary: "中文摘要", CriterionReviews: []applicationreview.CriterionResult{{CriterionID: "C1", Result: "met|unclear|unmet", Reason: "中文理由"}}, SuggestedSupplementTitle: "可为空"}}}
	if err := service.callModel(ctx, credential, system, payload, &output); err != nil {
		return output, err
	}
	return output, nil
}

func (service *Service) callModel(ctx context.Context, credential applicationaigateway.Credential, system string, payload, target any) error {
	content, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return err
	}
	return applicationaigateway.GenerateJSON(ctx, service.modelClient, applicationaigateway.GenerateInput{
		Credential: credential, System: system, User: string(content), MaxTokens: 8192, JSONMode: true,
	}, target)
}
