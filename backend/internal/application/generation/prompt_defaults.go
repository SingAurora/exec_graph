package generation

// platformOutputContract 只描述平台要求的 JSON 外壳，不包含具体核验内容。
const platformOutputContract = `只返回 JSON，不输出代码块或额外解释。
行动：{"reply":"","title":"","objective":"","reviews":[{"sourceId":"","complies":true|false|null,"exceptionReason":""}],"invalidImages":[{"ref":"","reason":""}]}
表达：{"reply":"","expression":{"mode":"update|clear","markdown":""}}
约定：{"reply":"","agreement":{"mode":"update|clear","markdown":""}}`

// defaultActionRequirement 是行动模式的默认内容核验要求，不包含输出格式。
const defaultActionRequirement = `记录本人本次实际做了什么、过程、结果和明确观察，也可以保留本人对这次经历的评价、感受和策略判断。
事实与想法分开：想法写成“我觉得/按这次体验”等主观表述，不把预测、计划或愿望写成已完成结果，也不推广为普遍结论。
不添加未报告的行动、细节、结果、长期人设、他人动机或历史/他人的经历；历史事实只作背景。
标题不超过 30 字，正文不超过 2000 字。
有引用来源时逐项核对来源约定；没有约定记为未知，明确不符要说明原因，不确定不要写成满足。
图片只使用正文占位符，不输出图片地址。`

// defaultExpressionRequirement 是表达模式的默认内容核验要求。
const defaultExpressionRequirement = `只修改当前表达，不改写行动、标题和约定。
每个判断必须有本轮可达行动依据；不能把聊天中新补充的经历当作已发布事实，也不能用已有表达、草稿或图指引自证。
没有依据的观点即使要求也不写；个人偏好和体验可以保留，但必须保持主观、有限范围。
首次生成必须 update；其他情况只能 update 或 clear，不能 inherit。`

// defaultAgreementRequirement 是约定模式的默认内容核验要求。
const defaultAgreementRequirement = `只整理当前节点向后传递的约定，不生成行动或表达。
约定要具体、可理解、可判断；不把愿望写成已发生事实，不替用户增加未表达的条件。
首次生成必须 update；其他情况只能 update 或 clear，不能 inherit。
用户明确要求保留时返回原文，明确清空时 clear。`

// PromptDefaults 是设置页只读展示的平台默认要求与输出契约。
type PromptDefaults struct {
	Contract   string `json:"contract"`
	Action     string `json:"action"`
	Expression string `json:"expression"`
	Agreement  string `json:"agreement"`
}

// DefaultPrompts 返回按“输出契约 + 三种模式要求”分离后的只读内容。
func DefaultPrompts() PromptDefaults {
	return PromptDefaults{
		Contract:   platformOutputContract,
		Action:     defaultActionRequirement,
		Expression: defaultExpressionRequirement,
		Agreement:  defaultAgreementRequirement,
	}
}
