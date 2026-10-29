package constants

import "time"

const (
	// AIPromptVersion 是允许确认发布的当前生成与核验规则版本。
	AIPromptVersion = "action-evidence-v2"
	// AIInputLimit 限制单轮用户输入和简短回复字符数。
	AIInputLimit = 10000
	// AIContextLimit 限制服务端组装后的总上下文字符数。
	AIContextLimit = 150000
	// AITimeout 是一次生成与独立核验共用的模型调用时限。
	AITimeout = 60 * time.Second
	// AIPendingTimeout 是进程中断后自动释放对话生成占用的时间。
	AIPendingTimeout = 2 * time.Minute
	// AIRequestTimeout 包括上下文事务、模型调用和输出保存。
	AIRequestTimeout = 100 * time.Second
	// AIOutputTokens 限制单轮生成成本。
	AIOutputTokens = 8192
)
