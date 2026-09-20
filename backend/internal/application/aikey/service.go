// Package aikey contains AI provider configuration use cases.
package aikey

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"

	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
	sharedid "github.com/singaurora/exec-graph/backend/internal/shared/id"
)

type Service struct {
	repository Repository
	cipher     SecretCipher
	verifier   ProviderVerifier
}

// New 创建 AI 密钥应用服务。
func New(dependencies Dependencies) *Service {
	return &Service{
		repository: dependencies.Repository,
		cipher:     dependencies.Cipher,
		verifier:   dependencies.Verifier,
	}
}

// ListAIKeys 返回当前用户保存的 AI 服务配置。
func (s *Service) ListAIKeys(ctx context.Context, userID uint64) ([]Key, error) {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	rows, err := s.repository.ListForUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	result := make([]Key, 0, len(rows))
	for _, item := range rows {
		result = append(result, fromRecord(item))
	}
	return result, nil
}

// CreateAIKey 验证并保存一份 AI 服务配置。
func (s *Service) CreateAIKey(ctx context.Context, userID uint64, provider, label, apiKey, baseURL, model string) (Key, error) {
	provider, label, apiKey, baseURL, model, err := normalize(provider, label, apiKey, baseURL, model)
	if err != nil {
		return Key{}, err
	}
	verifyCtx, cancelVerify := context.WithTimeout(ctx, sharedconstants.AIKeyTestTimeout)
	defer cancelVerify()
	if err := s.verifier.Verify(verifyCtx, provider, apiKey, baseURL, model); err != nil {
		return Key{}, err
	}
	ciphertext, err := s.cipher.Encrypt(apiKey)
	if err != nil {
		return Key{}, fmt.Errorf("encrypt AI key: %w", err)
	}
	id, err := sharedid.UUID()
	if err != nil {
		return Key{}, err
	}
	databaseCtx, cancelDatabase := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancelDatabase()
	record := &Record{UUID: id, UserID: userID, Provider: provider, Label: label, KeyCiphertext: ciphertext, KeyHint: mask(apiKey), BaseURL: baseURL, Model: model}
	if err := s.repository.Create(databaseCtx, record); err != nil {
		return Key{}, err
	}
	return fromRecord(*record), nil
}

// VerifySavedAIKey 重新验证一份已经保存的 AI 服务配置。
func (s *Service) VerifySavedAIKey(ctx context.Context, userID uint64, keyID string) (time.Time, error) {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.AIKeyVerificationTimeout)
	defer cancel()
	key, err := s.repository.FindForUser(ctx, userID, keyID)
	if errors.Is(err, ErrNotFound) {
		return time.Time{}, ErrNotFound
	}
	if err != nil {
		return time.Time{}, err
	}
	apiKey, err := s.cipher.Decrypt(key.KeyCiphertext)
	if err != nil {
		return time.Time{}, fmt.Errorf("decrypt AI key: %w", err)
	}
	if err := s.verifier.Verify(ctx, key.Provider, apiKey, key.BaseURL, key.Model); err != nil {
		return time.Time{}, err
	}
	verified := time.Now()
	if err := s.repository.MarkVerified(ctx, userID, keyID, verified); err != nil {
		return time.Time{}, err
	}
	return verified, nil
}

// TestAIKeyConfiguration 验证一份尚未保存的 AI 服务配置。
func (s *Service) TestAIKeyConfiguration(ctx context.Context, provider, label, apiKey, baseURL, model string) error {
	provider, _, apiKey, baseURL, model, err := normalize(provider, label, apiKey, baseURL, model)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.AIKeyTestTimeout)
	defer cancel()
	return s.verifier.Verify(ctx, provider, apiKey, baseURL, model)
}

// FindProjectReviewKey 返回项目配置的审查密钥，供需要调用模型的应用用例使用。
func (s *Service) FindProjectReviewKey(ctx context.Context, userID uint64, projectID string) (Credential, error) {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	item, err := s.repository.FindProjectReviewKey(ctx, userID, projectID)
	if errors.Is(err, ErrNotFound) {
		return Credential{}, ErrNotFound
	}
	if err != nil {
		return Credential{}, err
	}
	return s.credentialFromRecord(item)
}

// FindLatestProjectReviewKey 返回用户最近使用项目的审查凭据。
func (s *Service) FindLatestProjectReviewKey(ctx context.Context, userID uint64) (Credential, error) {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	item, err := s.repository.FindLatestProjectReviewKey(ctx, userID)
	if errors.Is(err, ErrNotFound) {
		return Credential{}, ErrNotFound
	}
	if err != nil {
		return Credential{}, err
	}
	return s.credentialFromRecord(item)
}

// MarkAIKeyUsed 更新指定 AI 密钥的最后使用时间。
func (s *Service) MarkAIKeyUsed(ctx context.Context, userID uint64, keyID string) error {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	return s.repository.MarkUsed(ctx, userID, keyID, time.Now())
}

// DeleteAIKey 删除一份未被项目使用的 AI 密钥。
func (s *Service) DeleteAIKey(ctx context.Context, userID uint64, keyID string) error {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	err := s.repository.DeleteUnusedForUser(ctx, userID, keyID)
	if errors.Is(err, ErrNotFound) {
		return ErrNotFound
	}
	if errors.Is(err, ErrInUse) {
		return ErrInUse
	}
	return err
}

func normalize(provider, label, apiKey, baseURL, model string) (string, string, string, string, string, error) {
	provider, label, apiKey, baseURL, model = strings.TrimSpace(provider), strings.TrimSpace(label), strings.TrimSpace(apiKey), strings.TrimRight(strings.TrimSpace(baseURL), "/"), strings.TrimSpace(model)
	if provider == "openai_compatible" {
		provider = "openai"
	}
	definition, ok := providers[provider]
	if !ok {
		return "", "", "", "", "", fmt.Errorf("请选择支持的 AI 服务")
	}
	if baseURL == "" {
		baseURL = definition.DefaultBaseURL
	}
	if label == "" {
		label = definition.Label
	}
	if model == "" {
		return "", "", "", "", "", fmt.Errorf("请输入模型名称")
	}
	parsed, err := url.ParseRequestURI(baseURL)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" || parsed.User != nil || len([]rune(label)) > 120 || len([]rune(model)) > 120 || len(apiKey) < 8 {
		return "", "", "", "", "", fmt.Errorf("请填写有效的密钥名称、模型、API Key 和服务地址")
	}
	return provider, label, apiKey, baseURL, model, nil
}
func fromRecord(item Record) Key {
	return Key{ID: item.UUID, Provider: item.Provider, Label: item.Label, KeyHint: item.KeyHint, BaseURL: item.BaseURL, Model: item.Model, LastVerifiedAt: item.LastVerifiedAt, LastUsedAt: item.LastUsedAt, CreatedAt: item.CreatedAt}
}

func (s *Service) credentialFromRecord(item Record) (Credential, error) {
	secret, err := s.cipher.Decrypt(item.KeyCiphertext)
	if err != nil {
		return Credential{}, fmt.Errorf("decrypt AI key: %w", err)
	}
	return Credential{ID: item.UUID, Provider: item.Provider, Label: item.Label, Secret: secret, BaseURL: item.BaseURL, Model: item.Model}, nil
}
func mask(value string) string {
	if len(value) <= 4 {
		return "****"
	}
	return "****" + value[len(value)-4:]
}
