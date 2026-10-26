package constants

import "time"

const (
	// MailOperationTimeout 限制单次验证码发送的外部请求时间。
	MailOperationTimeout = 20 * time.Second
	// CodeResendInterval 限制同一用途和邮箱的发送频率。
	CodeResendInterval = time.Minute
	// CodeSourceWindow 限制同一来源的邮件发送窗口。
	CodeSourceWindow = time.Hour
	// CodeSourceLimit 是每来源每小时发送上限。
	CodeSourceLimit = 20
	// CodeAttemptLimit 是单个验证码允许的核验次数。
	CodeAttemptLimit = 5
	// DefaultCodeTTL 是未填写有效配置时的验证码保留时间。
	DefaultCodeTTL = 10 * time.Minute
)
