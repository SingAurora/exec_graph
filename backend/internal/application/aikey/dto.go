package aikey

import "time"

// Provider 描述一个 AI 服务商的默认连接方式。
type Provider struct {
	Label          string
	DefaultBaseURL string
	AuthStyle      string
}

// Key 是 AI 密钥的应用层视图。
type Key struct {
	ID, Provider, Label, KeyHint, BaseURL, Model string
	LastVerifiedAt, LastUsedAt                   *time.Time
	CreatedAt                                    time.Time
}

// Credential 是仅供服务端调用 AI 服务商使用的解密凭据，不得进入 HTTP 响应。
type Credential struct {
	ID, Provider, Label, Secret, BaseURL, Model string
}
