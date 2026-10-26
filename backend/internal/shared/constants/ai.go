package constants

import "time"

const (
	// AIInputLimit 限制单轮用户输入和简短回复字符数。
	AIInputLimit = 10000
	// AIContextLimit 限制服务端组装后的总上下文字符数。
	AIContextLimit = 150000
	// AITimeout 限制真实模型网络调用。
	AITimeout = 60 * time.Second
	// AIPendingTimeout 是进程中断后自动释放对话生成占用的时间。
	AIPendingTimeout = 2 * time.Minute
	// AIRequestTimeout 包括上下文事务、模型调用和输出保存。
	AIRequestTimeout = 100 * time.Second
	// AIOutputTokens 限制单轮生成成本。
	AIOutputTokens = 8192
)
