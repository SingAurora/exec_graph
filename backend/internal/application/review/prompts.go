package review

import (
	"encoding/json"
	"strings"
)

func completionPrompt(request CompletionRequest) (string, string, error) {
	system := strings.Join([]string{
		"你是 Exec Graph 的行动记录辅助者，不是现实结果裁判。",
		"你的任务是根据项目规则、当前行动、做到位清单、记录要求、用户行动说明和用户材料，帮助用户看清这次实际记录覆盖了什么、哪些仍然未知，以及下一步可以怎么做。",
		"你无法知道现实中是否真的发生，也不能把用户的文字描述当成客观事实，更不能替用户证明最终效果。将 met 理解为“当前记录覆盖了这个关注点”，将 unclear 或 unmet 理解为“记录仍需观察或补充”，不要将其直接表述为现实行动失败。",
		"不要因为用户态度积极就放宽记录要求。不要引入冻结规则之外的新要求。",
		"若附有审查补充：原始完成说明和原始证据保持不可改写。普通澄清只能定位或解释原提交；若有“补交的既有证据”，用户明确声明其在首次提交前已经存在，你可将其作为独立、可追溯的补充材料核验，但不能把它当作本次复审后新完成的工作。",
		"只返回 JSON，不要 Markdown，不要额外解释。",
	}, "\n")
	user, err := json.MarshalIndent(map[string]any{
		"project": request.Project, "smartContract": request.SmartContract,
		"node":               map[string]any{"uuid": request.NodeID, "title": request.Title, "originalIntent": request.OriginalIntent, "verifiableGoal": request.VerifiableGoal},
		"acceptanceCriteria": request.AcceptanceCriteria, "evidenceRequirement": request.EvidenceRequirement,
		"completionClaim": request.CompletionClaim, "evidenceText": request.EvidenceText,
		"priorReview": request.PriorReview, "clarification": request.Clarification,
		"requiredJSONResponse": completionShape(),
	}, "", "  ")
	return system, string(user), err
}

func finalizationPrompt(request CompletionRequest, reasoning string) (string, string, error) {
	criteria := make([]string, 0, len(request.AcceptanceCriteria))
	for _, criterion := range request.AcceptanceCriteria {
		criteria = append(criteria, criterion.ID)
	}
	user, err := json.Marshal(map[string]any{"analysisToFinalize": reasoning, "criterionIds": criteria, "requiredJSONResponse": completionShape()})
	return "你是 Exec Graph 的行动记录辅助者。上一轮已完成分析但未输出结论。请依据提供的分析，直接返回最终 JSON；结论只能描述记录覆盖情况、未知信息和下一步建议，不能声称你知道现实结果。不要输出推理、Markdown 或额外文字。", string(user), err
}

func draftPrompt(request DraftRequest) (string, string, error) {
	system := strings.Join([]string{
		"你是 Exec Graph 的行动规划辅助者。",
		"你的任务是判断用户准备创建的行动草案是否足够清晰，且是否符合项目规则，能否保存为一次可推进的行动。",
		"只审查行动创建内容：标题、目标、做到位清单和记录要求。不要审查用户是否已经完成任务，也不要承诺未来可以证明现实结果。",
		"充分标准：读者能理解这次要推进什么、需要关注哪些细节、需要记录什么，以及下一步如何继续。",
		"不通过时给出具体缺口。只返回 JSON，不要 Markdown，不要额外解释。",
	}, "\n")
	user, err := json.MarshalIndent(map[string]any{
		"project": request.Project, "smartContract": request.SmartContract,
		"nodeDraft":            map[string]any{"title": request.Title, "verifiableGoal": request.VerifiableGoal, "acceptanceCriteria": request.AcceptanceCriteria, "evidenceRequirement": request.EvidenceRequirement, "rawDraft": request.Draft},
		"requiredJSONResponse": map[string]any{"verdict": "pass|fail", "summary": "中文审核摘要", "missingRequirements": []string{"不通过时列出需要补充的具体内容；通过时返回空数组"}},
	}, "", "  ")
	return system, string(user), err
}

func completionShape() map[string]any {
	return map[string]any{
		"verdict": "pass|partial|fail", "summary": "中文行动记录分析摘要",
		"criterionReviews":         []map[string]string{{"criterionId": "必须对应做到位清单 id", "result": "met|unclear|unmet", "reason": "中文理由；只描述记录覆盖和未知信息"}},
		"suggestedSupplementTitle": "未完全通过时给出下一步补足节点标题；通过时为空字符串",
	}
}
