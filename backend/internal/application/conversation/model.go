package conversation

import (
	"context"
	"encoding/json"
	"strings"

	applicationaigateway "github.com/singaurora/exec-graph/backend/internal/application/aigateway"
	applicationreview "github.com/singaurora/exec-graph/backend/internal/application/review"
	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
)

func (service *Service) requestPlanningConversation(ctx context.Context, credential applicationaigateway.Credential, conversation View, freezeReview bool) (planningConversationOutput, error) {
	var output planningConversationOutput
	quickAction := isQuickActionContext(conversation.Context)
	system := "你是 ExecG 的行动规划协作者。通过尽量少的中文对话，把用户想做的事整理成一次真实、可开始的推进。不要假装用户已经完成，也不要承诺 AI 能证明现实结果。规则引导型项目必须遵从项目规则；其他项目只帮助澄清。回应友好、简洁，只返回 JSON。"
	if quickAction {
		system += "当前使用行动质量指南：只找 1 到 3 个最重要的关注点，优先从核心效果、关键质量或风险、收尾状态中选择；不要机械套用固定分类，也不要追问次要细节，不要求截图、链接或逐条证明；未知信息写成待观察。记录要求保持为一句简短提示。"
	} else {
		system += "草案需要有标题、目标、做到位清单和记录要求。"
	}
	if isRevisionContext(conversation.Context) {
		system += "当前不是创建新行动，而是修改已有行动要求。先理解上下文中的原要求，只保留仍然有效的部分，并根据用户说明调整标题、目标、关注点和记录提示。不要假设用户已经完成行动；用户明确确认前，不要认为新要求已经生效。"
	}
	if freezeReview {
		if quickAction {
			system += "当前用户明确请求保存为推进。只要标题、目标和至少一个关注点已经清楚，就将 readyForFreezeReview 设为 true。"
		} else {
			system += "当前用户明确请求保存为推进。只有草案完整且每条做到位清单可独立观察时，readyForFreezeReview 才能为 true。"
		}
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
	output.Draft.AcceptanceCriteria = trimCriteria(output.Draft.AcceptanceCriteria, quickAction)
	if quickAction && output.Draft.EvidenceRequirement == "" {
		output.Draft.EvidenceRequirement = "记录实际做了什么、最重要的变化，以及仍需观察的地方。"
	}
	return output, nil
}

func isRevisionContext(value any) bool {
	bytes, err := json.Marshal(value)
	if err != nil {
		return false
	}
	var contextValue struct {
		Revision *RevisionTarget `json:"revision"`
	}
	return json.Unmarshal(bytes, &contextValue) == nil && contextValue.Revision != nil
}

func (service *Service) requestCompletionConversationReply(ctx context.Context, credential applicationaigateway.Credential, conversation View) (completionConversationReply, error) {
	var output completionConversationReply
	quickAction := isQuickActionContext(conversation.Context)
	system := "你是 ExecG 的行动完成说明协作者。根据已经保存的行动规则，通过简短中文对话帮助用户把实际做了什么说清楚。不能把计划补写成已经发生，不能声称你知道现实结果，也不要在对话阶段给出通过、失败或最终验收结论。先概括已经明确的事实；只有关键内容确实缺失时，最多追问一个最重要的问题。只返回 JSON。"
	if quickAction {
		system += "当前使用行动质量指南：围绕 1 到 3 个关键点交流，不追问次要细节，不要求截图或链接。若核心效果、关键质量或风险、收尾状态已经足够清楚，就告诉用户可以生成最终结论。"
	} else {
		system += "不能修改目标、做到位清单或记录要求。结合验收标准指出最值得补充的一处信息；不要逐条重复所有标准。"
	}
	payload := struct {
		Context              any                         `json:"context"`
		Messages             []MessageView               `json:"messages"`
		RequiredJSONResponse completionConversationReply `json:"requiredJSONResponse"`
	}{Context: conversation.Context, Messages: conversation.Messages, RequiredJSONResponse: completionConversationReply{Reply: "简短中文回复；必要时只问一个关键问题"}}
	if err := service.callModel(ctx, credential, system, payload, &output); err != nil {
		return output, err
	}
	return output, nil
}

func (service *Service) requestCompletionConversationConclusion(ctx context.Context, credential applicationaigateway.Credential, conversation View) (completionConversationConclusion, error) {
	var output completionConversationConclusion
	quickAction := isQuickActionContext(conversation.Context)
	system := "你是 ExecG 的行动完成审查者。用户已经结束说明，请只根据完整对话和冻结的行动规则生成一次完整的最终结论。不能把计划、建议或 AI 的追问当成已发生事实，也不能声称你验证了现实。最终结论必须总结实际说明，并逐条给出验收覆盖情况。只返回 JSON。"
	if quickAction {
		system += "当前使用行动质量指南：围绕 1 到 3 个关键点给出简短结论；不因缺少截图、链接或次要细节判定失败，不生成补足行动。verdict 表示用户说明的覆盖程度，优先使用 pass 或 partial。"
	} else {
		system += "不能修改目标、做到位清单或记录要求。未被用户说明支持的内容应标为 unclear 或 unmet，不得推断补全。"
	}
	payload := struct {
		Context              any                              `json:"context"`
		Messages             []MessageView                    `json:"messages"`
		RequiredJSONResponse completionConversationConclusion `json:"requiredJSONResponse"`
	}{Context: conversation.Context, Messages: conversation.Messages, RequiredJSONResponse: completionConversationConclusion{Reply: "完整中文最终结论", Review: applicationreview.ModelOutput{Verdict: "pass|partial|fail", Summary: "中文摘要", CriterionReviews: []applicationreview.CriterionResult{{CriterionID: "C1", Result: "met|unclear|unmet", Reason: "中文理由"}}, SuggestedSupplementTitle: "可为空"}}}
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
	maxTokens := 8192
	if strings.Contains(system, "行动质量指南") {
		maxTokens = 2048
	}
	return applicationaigateway.GenerateJSON(ctx, service.modelClient, applicationaigateway.GenerateInput{
		Credential: credential, System: system, User: string(content), MaxTokens: maxTokens, JSONMode: true,
		Timeout: sharedconstants.ConversationModelHTTPTimeout,
	}, target)
}
