package review

import (
	"encoding/json"
	"strings"
)

func completionPrompt(request CompletionRequest) (string, string, error) {
	system := strings.Join([]string{
		"你是 Exec Graph 的智能合约审查器。",
		"你的任务是根据项目规则、当前行动契约、验收标准、证据要求、用户完成说明和用户证据，判断这次推进是否足以锁定。",
		"不要因为用户态度积极就放宽标准。不要引入冻结规则之外的新要求。",
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
	return "你是 Exec Graph 的智能合约审查器。上一轮已完成分析但未输出结论。请依据提供的分析，直接返回最终审查 JSON，不要输出推理、Markdown 或额外文字。", string(user), err
}

func draftPrompt(request DraftRequest) (string, string, error) {
	system := strings.Join([]string{
		"你是 Exec Graph 的推进节点草案审查器。",
		"你的任务是判断用户准备创建的节点草案是否足够清晰，且是否符合项目规则，能否被冻结为一次真实推进的行动契约。",
		"只审查节点创建内容：标题、可验证目标、验收标准和证据要求。不要审查用户是否已经完成任务。",
		"通过标准：读者能理解这次推进要完成什么，AI 将来能依据冻结标准审查提交结果。",
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
		"verdict": "pass|partial|fail", "summary": "中文审查摘要",
		"criterionReviews":         []map[string]string{{"criterionId": "必须对应验收标准 id", "result": "met|unclear|unmet", "reason": "中文理由"}},
		"suggestedSupplementTitle": "未完全通过时给出下一步补足节点标题；通过时为空字符串",
	}
}
