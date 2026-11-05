package generation

// platformOutputContract 只描述平台要求的 JSON 外壳，不包含具体核验内容。
const platformOutputContract = `只返回 JSON，不输出代码块或额外解释。
行动：{"reply":"","title":"","objective":"","reviews":[{"sourceId":"","complies":true|false|null,"exceptionReason":""}],"invalidImages":[{"ref":"","reason":""}]}
表达：{"reply":"","expression":{"mode":"update|clear","markdown":""}}
约定：{"reply":"","agreement":{"mode":"update|clear","markdown":""}}`

// defaultActionRequirement 是行动模式的默认内容核验要求，不包含输出格式。
const defaultActionRequirement = `目标效果：一条能直接确认发布的行动记录，让别人读得懂本人实际做了什么、结果如何、本人怎么判断。
大部分篇幅用“我做了什么”的动作说明，写清本次实际做了什么、过程、结果和明确观察；少量无法判断或无关内容可以忽略，不因此拒绝整篇。也可以保留本人对这次经历的评价、感受和策略判断。
事实与想法分开：想法写成“我觉得/按这次体验”等主观表述，不把预测、计划或愿望写成已完成结果，也不推广为普遍结论。
不添加未报告的行动、细节、结果、长期人设、他人动机或历史/他人的经历；历史事实只作背景。
标题不超过 30 字，正文不超过 2000 字。
接续行动必须为每个直接来源输出核对项，即使来源没有约定或本轮没有提到约定也要输出 null；明确不符要说明原因，不确定不要写成满足。
图片只使用正文占位符，不输出图片地址。`

// defaultExpressionRequirement 是表达模式的默认内容核验要求。
const defaultExpressionRequirement = `目标效果：一条能吸引其他用户继续看的表达，让人看出你关心什么、持什么态度，而不是行动摘要或流水账。
写你从行动中显露出的兴趣、偏好、态度、判断或想继续讨论的问题，用一两句具体行动作事实锚点，让人愿意看和回应。
涉及行动过程、结果、观察的陈述必须有本轮行动依据；兴趣、偏好、态度、感受和评价可以直接表达，但不能写成客观事实、已发生结果或普遍结论，也不要写内部免责声明或复述配图。
首次生成必须 update；其他情况只能 update 或 clear，不能 inherit。`

// defaultAgreementRequirement 是约定模式的默认内容核验要求。
const defaultAgreementRequirement = `目标效果：一条具体、可理解、可判断、能向后传递的约定，不是愿望或口号。
只整理当前节点向后传递的约定，不生成行动或表达。
约定要从当前已发布行动及其表达中显露的合作边界和条件出发，具体、可理解、可判断；不凭空增加与行动无关的条件，不把愿望写成已发生事实，不替用户增加未表达的条件。
首次生成必须 update；其他情况只能 update 或 clear，不能 inherit。
用户明确要求保留时返回原文，明确清空时 clear。`

// PromptDefaults 是设置页只读展示的平台默认要求与输出契约。
type PromptDefaults struct {
	Contract               string `json:"contract"`
	Action                 string `json:"action"`
	Expression             string `json:"expression"`
	Agreement              string `json:"agreement"`
	VerificationAction     string `json:"verificationAction"`
	VerificationExpression string `json:"verificationExpression"`
	VerificationAgreement  string `json:"verificationAgreement"`
}

// DefaultPrompts 返回按“输出契约 + 三种模式要求”分离后的只读内容。
func DefaultPrompts() PromptDefaults {
	return PromptDefaults{
		Contract:               platformOutputContract,
		Action:                 defaultActionRequirement,
		Expression:             defaultExpressionRequirement,
		Agreement:              defaultAgreementRequirement,
		VerificationAction:     verificationRulesFor("action"),
		VerificationExpression: verificationRulesFor("expression"),
		VerificationAgreement:  verificationRulesFor("agreement"),
	}
}
