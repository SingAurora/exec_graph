package constants

import "time"

const (
	// DemoPassword 是 demo 明文模式下现有账号的统一密码；禁止用于生产。
	DemoPassword = "demo123456"
	// EmailMaxBytes 限制规范化后的邮箱 UTF-8 字节数；常见邮箱均为 ASCII，因此等同于常见字符数上限。
	EmailMaxBytes = 64
	// PasswordMinCharacters 限制新密码的最少字符数，不追溯限制旧密码登录。
	PasswordMinCharacters = 8
	// PasswordMaxBytes 限制新密码的 ASCII 字节数；新密码只接受英文、数字和可见普通符号。
	PasswordMaxBytes = 32
	// LegacyPasswordMaxBytes 保留旧账号登录和修改密码时当前密码的兼容上限。
	LegacyPasswordMaxBytes = 256
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
