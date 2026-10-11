package conversation

import (
	"context"
	"encoding/json"
	"regexp"
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
		system += "当前使用行动质量指南：只找 1 到 3 个最重要的关注点，优先从核心效果、关键质量或风险、收尾状态中选择；不要机械套用固定分类，也不要追问次要细节，不要求截图、链接或逐条证明；未知信息写成待观察。记录要求保持为一句简短提示。必须把关注点逐条写入 draft.acceptanceCriteria 数组；reply 中的总结不能替代这个数组，不能返回空数组。"
	} else {
		system += "草案需要有标题、目标、做到位清单和记录要求。必须把做到位清单逐条写入 draft.acceptanceCriteria 数组；reply 中的总结不能替代这个数组。"
	}
	if isRevisionContext(conversation.Context) {
		system += "当前不是创建新行动，而是修改已有行动要求。先理解上下文中的原要求，只保留仍然有效的部分，并根据用户说明调整标题、目标、关注点和记录提示。不要假设用户已经完成行动；用户明确确认前，不要认为新要求已经生效。"
	}
	if freezeReview {
		system += "当前用户明确请求对行动草案做最终检查。必须额外返回 review：verdict 只能是 pass 或 fail，summary 说明当前草案是否足够清楚，missingRequirements 列出仍缺失的具体项目；只有 verdict 为 pass 且没有缺口时 readyForFreezeReview 才能为 true。这个 review 是对当前草案的临时分析，不代表行动已经完成。"
		if quickAction {
			system += "当前用户明确请求保存为推进。只要标题、目标和至少一个关注点已经清楚，就将 readyForFreezeReview 设为 true。"
		} else {
			system += "当前用户明确请求保存为推进。只有草案完整且每条做到位清单可独立观察时，readyForFreezeReview 才能为 true。"
		}
	}
	requiredResponse := planningConversationOutput{Reply: "中文回复", Draft: ActionDraft{}, ReadyForFreeze: false}
	if freezeReview {
		requiredResponse.Review = &PlanningReview{Verdict: "pass|fail", Summary: "中文审查摘要", MissingRequirements: []string{"具体缺口；没有缺口时为空数组"}}
	}
	payload := struct {
		Context              any                        `json:"context"`
		CurrentDraft         *ActionDraft               `json:"currentDraft"`
		Messages             []MessageView              `json:"messages"`
		RequiredJSONResponse planningConversationOutput `json:"requiredJSONResponse"`
	}{Context: conversation.Context, CurrentDraft: conversation.CurrentDraft, Messages: conversation.Messages, RequiredJSONResponse: requiredResponse}
	if err := service.callModel(ctx, credential, system, payload, &output); err != nil {
		return output, err
	}
	output.Draft = normalizePlanningDraft(output.Draft, conversation.CurrentDraft, output.Reply, quickAction)
	if quickAction && output.Draft.EvidenceRequirement == "" {
		output.Draft.EvidenceRequirement = "记录实际做了什么、最重要的变化，以及仍需观察的地方。"
	}
	return output, nil
}

func normalizePlanningDraft(draft ActionDraft, previous *ActionDraft, reply string, quickAction bool) ActionDraft {
	draft.Title = strings.TrimSpace(draft.Title)
	draft.VerifiableGoal = strings.TrimSpace(draft.VerifiableGoal)
	draft.EvidenceRequirement = strings.TrimSpace(draft.EvidenceRequirement)
	draft.AcceptanceCriteria = trimCriteria(draft.AcceptanceCriteria, quickAction)
	if previous != nil {
		if draft.Title == "" {
			draft.Title = previous.Title
		}
		if draft.VerifiableGoal == "" {
			draft.VerifiableGoal = previous.VerifiableGoal
		}
		if draft.EvidenceRequirement == "" {
			draft.EvidenceRequirement = previous.EvidenceRequirement
		}
		if len(draft.AcceptanceCriteria) == 0 {
			draft.AcceptanceCriteria = trimCriteria(previous.AcceptanceCriteria, quickAction)
		}
	}
	if len(draft.AcceptanceCriteria) == 0 {
		draft.AcceptanceCriteria = extractNumberedCriteria(reply, quickAction)
	}
	return draft
}

var numberedCriteriaPattern = regexp.MustCompile(`(?:^|[：:；;，,。])\s*(?:\d+|[一二三四五六七八九十]+)\s*[、.)）:：]\s*([^；;。]+)`)
var bulletCriteriaPattern = regexp.MustCompile(`^\s*(?:[-*•]|\d+[.)、）])\s*(.+?)\s*$`)

func extractNumberedCriteria(reply string, quickAction bool) []string {
	criteria := make([]string, 0, 3)
	for _, match := range numberedCriteriaPattern.FindAllStringSubmatch(strings.TrimSpace(reply), -1) {
		if len(match) < 2 {
			continue
		}
		if value := strings.Trim(strings.TrimSpace(match[1]), "，,；;。 "); value != "" {
			criteria = append(criteria, value)
		}
	}
	if len(criteria) == 0 {
		for _, line := range strings.Split(reply, "\n") {
			match := bulletCriteriaPattern.FindStringSubmatch(line)
			if len(match) < 2 {
				continue
			}
			if value := strings.Trim(strings.TrimSpace(match[1]), "，,；;。 "); value != "" {
				criteria = append(criteria, value)
			}
		}
	}
	return trimCriteria(criteria, quickAction)
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
		system += "当前是日常行动记录，不要逐条输出验收状态，也不要把对话变成审查问卷。围绕 1 到 3 个最重要的事实交流，不追问次要细节，不要求截图或链接。若用户已经说明实际做了什么，就简洁复述；若仍有一个关键事实不清楚，只追问这一件事。progress 的四个数组保持为空。"
	} else {
		system += "不能修改目标、做到位清单或记录要求。每轮都要在 progress 中解析当前用户说明对每条行动重点的覆盖情况：confirmed 表示用户明确用已完成的事实说明覆盖了该重点；unclear 表示该重点的内容已经被提到，但用户使用了计划、步骤、应该、准备等语气，或其他原因导致是否实际完成仍不清楚；notMentioned 只允许用于该重点的内容在用户全部消息中都没有出现；notCompleted 表示用户明确说没有完成。内容已提到但尚未确认完成时，必须使用 unclear。结合验收标准指出最值得补充的一处信息；不要逐条重复所有标准。"
	}
	payload := struct {
		Context              any                         `json:"context"`
		Messages             []MessageView               `json:"messages"`
		RequiredJSONResponse completionConversationReply `json:"requiredJSONResponse"`
	}{Context: conversation.Context, Messages: conversation.Messages, RequiredJSONResponse: completionConversationReply{
		Reply: "简短中文回复；必要时只问一个关键问题",
		Progress: CompletionProgress{
			Confirmed:    []CompletionProgressItem{},
			Unclear:      []CompletionProgressItem{},
			NotMentioned: []CompletionProgressItem{},
			NotCompleted: []CompletionProgressItem{},
		},
	}}
	if err := service.callModel(ctx, credential, system, payload, &output); err != nil {
		return output, err
	}
	if quickAction {
		return output, nil
	}
	output.Progress = normalizeCompletionProgress(output.Progress, conversation.Context)
	return output, nil
}

func (service *Service) requestCompletionConversationConclusion(ctx context.Context, credential applicationaigateway.Credential, conversation View) (completionConversationConclusion, error) {
	var output completionConversationConclusion
	quickAction := isQuickActionContext(conversation.Context)
	system := "你是 ExecG 的行动完成审查者。用户已经结束说明，请只根据完整对话和冻结的行动规则生成一次完整的最终结论。不能把计划、建议或 AI 的追问当成已发生事实，也不能声称你验证了现实。最终结论必须总结实际说明，并逐条给出验收覆盖情况；progress 使用与对话中相同的四类状态，逐条反映完整对话的最终覆盖情况。注意：notMentioned 只表示行动重点内容在用户消息中完全没有出现；内容已经提到但只是计划语气、没有明确实际完成时，应使用 unclear，而不是 notMentioned。只返回 JSON。"
	if quickAction {
		system = "你是 ExecG 的日常行动记录整理者。根据完整对话，生成一条简短、诚实的完成记录。不要把计划或建议当成已完成事实，不要声称你验证了现实；只记录用户明确说过的内容。围绕 1 到 3 个最重要的行动重点给出简洁结论，不因缺少截图、链接或次要细节判定失败，不生成补足行动。verdict 表示用户说明的覆盖程度，优先使用 pass 或 partial。只返回 JSON。"
	} else {
		system += "不能修改目标、做到位清单或记录要求。未被用户说明支持的内容应标为 unclear 或 unmet，不得推断补全。"
	}
	payload := struct {
		Context              any                              `json:"context"`
		Messages             []MessageView                    `json:"messages"`
		RequiredJSONResponse completionConversationConclusion `json:"requiredJSONResponse"`
	}{Context: conversation.Context, Messages: conversation.Messages, RequiredJSONResponse: completionConversationConclusion{
		Reply: "完整中文最终结论",
		Progress: CompletionProgress{
			Confirmed:    []CompletionProgressItem{},
			Unclear:      []CompletionProgressItem{},
			NotMentioned: []CompletionProgressItem{},
			NotCompleted: []CompletionProgressItem{},
		},
		Review: applicationreview.ModelOutput{Verdict: "pass|partial|fail", Summary: "中文摘要", CriterionReviews: []applicationreview.CriterionResult{{CriterionID: "C1", Result: "met|unclear|unmet", Reason: "中文理由"}}, SuggestedSupplementTitle: "可为空"},
	}}
	if err := service.callModel(ctx, credential, system, payload, &output); err != nil {
		return output, err
	}
	output.Progress = normalizeCompletionProgress(output.Progress, conversation.Context)
	return output, nil
}

func normalizeCompletionProgress(progress CompletionProgress, contextValue any) CompletionProgress {
	result := CompletionProgress{
		Confirmed:    make([]CompletionProgressItem, 0),
		Unclear:      make([]CompletionProgressItem, 0),
		NotMentioned: make([]CompletionProgressItem, 0),
		NotCompleted: make([]CompletionProgressItem, 0),
	}
	criteria := completionCriteriaFromContext(contextValue)
	known := make(map[string]struct{}, len(criteria))
	for _, criterion := range criteria {
		known[criterion.ID] = struct{}{}
	}
	seen := make(map[string]struct{}, len(criteria))
	appendItem := func(target *[]CompletionProgressItem, item CompletionProgressItem, status string) {
		item.CriterionID = strings.TrimSpace(item.CriterionID)
		item.Reason = strings.TrimSpace(item.Reason)
		if item.CriterionID == "" || item.Reason == "" {
			return
		}
		if _, ok := known[item.CriterionID]; !ok {
			return
		}
		if _, ok := seen[item.CriterionID]; ok {
			return
		}
		item.Status = status
		seen[item.CriterionID] = struct{}{}
		*target = append(*target, item)
	}
	for _, item := range progress.Confirmed {
		appendItem(&result.Confirmed, item, "confirmed")
	}
	for _, item := range progress.Unclear {
		appendItem(&result.Unclear, item, "unclear")
	}
	for _, item := range progress.NotMentioned {
		appendItem(&result.NotMentioned, item, "notMentioned")
	}
	for _, item := range progress.NotCompleted {
		appendItem(&result.NotCompleted, item, "notCompleted")
	}
	for _, criterion := range criteria {
		if _, ok := seen[criterion.ID]; ok {
			continue
		}
		result.NotMentioned = append(result.NotMentioned, CompletionProgressItem{CriterionID: criterion.ID, Status: "notMentioned", Reason: "当前对话尚未明确说明。"})
	}
	return result
}

func completionCriteriaFromContext(contextValue any) []applicationreview.Criterion {
	encoded, err := json.Marshal(contextValue)
	if err != nil {
		return nil
	}
	var payload struct {
		Node struct {
			AcceptanceCriteria []applicationreview.Criterion `json:"acceptanceCriteria"`
		} `json:"node"`
	}
	if json.Unmarshal(encoded, &payload) != nil {
		return nil
	}
	return payload.Node.AcceptanceCriteria
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
