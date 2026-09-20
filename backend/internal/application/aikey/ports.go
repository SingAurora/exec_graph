package aikey

import (
	"context"
	"time"
)

// Record 是 AI 密钥仓储在应用层使用的持久化记录。
type Record struct {
	ID             uint64
	UUID           string
	UserID         uint64
	Provider       string
	Label          string
	KeyCiphertext  string
	KeyHint        string
	BaseURL        string
	Model          string
	LastVerifiedAt *time.Time
	LastUsedAt     *time.Time
	CreatedAt      time.Time
}

// Repository 定义 AI 密钥用例需要的持久化能力。
type Repository interface {
	Create(ctx context.Context, key *Record) error
	MarkVerified(ctx context.Context, userID uint64, keyUUID string, verifiedAt time.Time) error
	DeleteUnusedForUser(ctx context.Context, userID uint64, keyUUID string) error
	ListForUser(ctx context.Context, userID uint64) ([]Record, error)
	FindForUser(ctx context.Context, userID uint64, keyUUID string) (Record, error)
	FindProjectReviewKey(ctx context.Context, userID uint64, projectUUID string) (Record, error)
	FindLatestProjectReviewKey(ctx context.Context, userID uint64) (Record, error)
	MarkUsed(ctx context.Context, userID uint64, keyUUID string, usedAt time.Time) error
}

// SecretCipher 定义 AI 密钥静态加密能力。
type SecretCipher interface {
	Encrypt(plaintext string) (string, error)
	Decrypt(ciphertext string) (string, error)
}

// ProviderVerifier 验证 AI 服务配置是否能完成一次最小请求。
type ProviderVerifier interface {
	Verify(ctx context.Context, provider, apiKey, baseURL, model string) error
}

// Dependencies 是 AI 密钥应用服务所需的端口。
type Dependencies struct {
	Repository Repository
	Cipher     SecretCipher
	Verifier   ProviderVerifier
}
