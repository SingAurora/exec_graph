// Package aikey contains AI provider configuration use cases.
package aikey

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	aikeypersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/aikey"
	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
	sharedid "github.com/singaurora/exec-graph/backend/internal/shared/id"
)

type Service struct {
	repository aikeypersistence.AIKeyRepository
}

func New(repository aikeypersistence.AIKeyRepository) *Service {
	return &Service{repository: repository}
}

func (s *Service) List(ctx context.Context, userID uint64) ([]Key, error) {
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

func (s *Service) Create(ctx context.Context, userID uint64, provider, label, apiKey, baseURL, model string) (Key, error) {
	provider, label, apiKey, baseURL, model, err := normalize(provider, label, apiKey, baseURL, model)
	if err != nil {
		return Key{}, err
	}
	id, err := sharedid.Opaque("ai-key")
	if err != nil {
		return Key{}, err
	}
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	record := &aikeypersistence.AIKey{UUID: id, UserID: userID, Provider: provider, Label: label, KeyCiphertext: apiKey, KeyHint: mask(apiKey), BaseURL: baseURL, Model: model}
	if err := s.repository.Create(ctx, record); err != nil {
		return Key{}, err
	}
	return Key{ID: id, Provider: provider, Label: label, APIKey: apiKey, KeyHint: mask(apiKey), BaseURL: baseURL, Model: model, CreatedAt: time.Now()}, nil
}

func (s *Service) Verify(ctx context.Context, userID uint64, keyID string) (time.Time, error) {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.AIKeyVerificationTimeout)
	defer cancel()
	key, err := s.repository.FindForUser(ctx, userID, keyID)
	if errors.Is(err, aikeypersistence.ErrNotFound) {
		return time.Time{}, ErrNotFound
	}
	if err != nil {
		return time.Time{}, err
	}
	if err := probe(ctx, key.Provider, key.KeyCiphertext, key.BaseURL, key.Model); err != nil {
		return time.Time{}, err
	}
	verified := time.Now()
	if err := s.repository.MarkVerified(ctx, userID, keyID, verified); err != nil {
		return time.Time{}, err
	}
	return verified, nil
}

func (s *Service) Test(ctx context.Context, provider, label, apiKey, baseURL, model string) error {
	provider, _, apiKey, baseURL, model, err := normalize(provider, label, apiKey, baseURL, model)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.AIKeyTestTimeout)
	defer cancel()
	return probe(ctx, provider, apiKey, baseURL, model)
}

// FindProjectReviewKey 返回项目配置的审查密钥，供需要调用模型的应用用例使用。
func (s *Service) FindProjectReviewKey(ctx context.Context, userID uint64, projectID string) (Key, error) {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	item, err := s.repository.FindProjectReviewKey(ctx, userID, projectID)
	if errors.Is(err, aikeypersistence.ErrNotFound) {
		return Key{}, ErrNotFound
	}
	if err != nil {
		return Key{}, err
	}
	return fromRecord(item), nil
}

func (s *Service) FindLatestProjectReviewKey(ctx context.Context, userID uint64) (Key, error) {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	item, err := s.repository.FindLatestProjectReviewKey(ctx, userID)
	if errors.Is(err, aikeypersistence.ErrNotFound) {
		return Key{}, ErrNotFound
	}
	if err != nil {
		return Key{}, err
	}
	return fromRecord(item), nil
}

func (s *Service) MarkUsed(ctx context.Context, userID uint64, keyID string) error {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	return s.repository.MarkUsed(ctx, userID, keyID, time.Now())
}

func (s *Service) Delete(ctx context.Context, userID uint64, keyID string) error {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	err := s.repository.DeleteUnusedForUser(ctx, userID, keyID)
	if errors.Is(err, aikeypersistence.ErrNotFound) {
		return ErrNotFound
	}
	if errors.Is(err, aikeypersistence.ErrInUse) {
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
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" || len([]rune(label)) > 120 || len([]rune(model)) > 120 || len(apiKey) < 8 {
		return "", "", "", "", "", fmt.Errorf("请填写有效的密钥名称、模型、API Key 和服务地址")
	}
	return provider, label, apiKey, baseURL, model, nil
}
func fromRecord(item aikeypersistence.AIKey) Key {
	return Key{ID: item.UUID, Provider: item.Provider, Label: item.Label, APIKey: item.KeyCiphertext, KeyHint: item.KeyHint, BaseURL: item.BaseURL, Model: item.Model, LastVerifiedAt: item.LastVerifiedAt, LastUsedAt: item.LastUsedAt, CreatedAt: item.CreatedAt}
}
func mask(value string) string {
	if len(value) <= 4 {
		return "****"
	}
	return "****" + value[len(value)-4:]
}

func probe(ctx context.Context, provider, apiKey, baseURL, model string) error {
	definition, ok := providers[provider]
	if !ok {
		return fmt.Errorf("AI 服务地址不正确")
	}
	endpoint, payload := strings.TrimRight(baseURL, "/")+"/chat/completions", map[string]any{"model": model, "max_tokens": 8, "temperature": 0, "messages": []map[string]string{{"role": "user", "content": "ping"}}}
	if definition.AuthStyle == "anthropic" {
		endpoint = strings.TrimRight(baseURL, "/") + "/messages"
		payload = map[string]any{"model": model, "max_tokens": 8, "messages": []map[string]string{{"role": "user", "content": "ping"}}}
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", "application/json")
	if definition.AuthStyle == "anthropic" {
		request.Header.Set("x-api-key", apiKey)
		request.Header.Set("anthropic-version", "2023-06-01")
	} else {
		request.Header.Set("Authorization", "Bearer "+apiKey)
	}
	response, err := (&http.Client{Timeout: sharedconstants.AIKeyProbeHTTPTimeout}).Do(request)
	if err != nil {
		return fmt.Errorf("无法连接 AI 服务，请检查地址、模型和网络")
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return fmt.Errorf("AI 服务未接受此密钥或模型，请检查 API Key、服务地址和模型名称")
	}
	return nil
}
