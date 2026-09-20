package constants

import "time"

const (
	// DatabasePingTimeout 限制打开数据库连接时的连通性检查时间。
	DatabasePingTimeout = 8 * time.Second
	// DatabaseOperationTimeout 限制普通 HTTP 请求中的数据库操作时间。
	DatabaseOperationTimeout = 8 * time.Second
	// HTTPReadHeaderTimeout 限制客户端发送请求头的最长时间。
	HTTPReadHeaderTimeout = 10 * time.Second
	// HTTPReadTimeout、HTTPWriteTimeout 和 HTTPIdleTimeout 限制完整请求、响应和空闲连接。
	HTTPReadTimeout  = 30 * time.Second
	HTTPWriteTimeout = 2 * time.Minute
	HTTPIdleTimeout  = 60 * time.Second
	// HTTPShutdownTimeout 限制进程收到终止信号后的优雅停机时间。
	HTTPShutdownTimeout = 20 * time.Second

	// RedisDialTimeout 和 RedisPingTimeout 限制启动时 Redis 的连通性检查时间。
	RedisDialTimeout = 2 * time.Second
	RedisPingTimeout = 3 * time.Second
	// SessionLogoutTimeout 限制退出登录时尽力清理会话缓存的时间。
	SessionLogoutTimeout = 5 * time.Second

	// VerificationCodeTimeout 覆盖验证码邮件发送与记录持久化的总时间。
	VerificationCodeTimeout = 15 * time.Second
	// ProfileMediaTimeout 限制对象存储上传和个人资料更新的总时间。
	ProfileMediaTimeout = 30 * time.Second
	// ProfileMediaURLTTL 是头像和个人主页背景图临时访问地址的有效期。
	ProfileMediaURLTTL = 24 * time.Hour
	// ConversationSetupTimeout 用于短时的对话读取和初始化。
	ConversationSetupTimeout = 10 * time.Second
	// ConversationReviewTimeout 覆盖一次模型响应及其结果持久化。
	ConversationReviewTimeout = 85 * time.Second
	// ConversationModelHTTPTimeout 限制单次对话模型 HTTP 请求时间。
	ConversationModelHTTPTimeout = 80 * time.Second

	// AIKeyVerificationTimeout 限制已保存 AI 密钥的验证请求时间。
	AIKeyVerificationTimeout = 20 * time.Second
	// AIKeyTestTimeout 限制未保存 AI 密钥配置的测试时间。
	AIKeyTestTimeout = 30 * time.Second
	// AIKeyProbeHTTPTimeout 限制向 AI 服务商发起探测的请求时间。
	AIKeyProbeHTTPTimeout = 20 * time.Second

	// CompletionReviewTimeout 覆盖完成审查或补充说明审查的总时间。
	CompletionReviewTimeout = 110 * time.Second
	// NodeDraftReviewTimeout 限制节点草案审查与结果规范化的总时间。
	NodeDraftReviewTimeout = 70 * time.Second
	// AIReviewHTTPTimeout 和 AIReviewFinalizationHTTPTimeout 限制 AI 服务商调用时间。
	AIReviewHTTPTimeout             = 65 * time.Second
	AIReviewFinalizationHTTPTimeout = 40 * time.Second

	// WorkOverviewTimeout 限制加载一个月行动记录的时间。
	WorkOverviewTimeout = 10 * time.Second
	// DailyWorkReviewTimeout 覆盖日结模型调用和审查结果保存的总时间。
	DailyWorkReviewTimeout = 100 * time.Second
)
