package app

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	infrastructuremysql "github.com/singaurora/exec-graph/backend/internal/infrastructure/mysql"
)

const (
	aiProviderDeepSeek = "deepseek"
	aiProviderOpenAI   = "openai"
	aiProviderDoubao   = "doubao"
	aiProviderClaude   = "claude"
)

type aiProviderDefinition struct {
	Label          string
	DefaultBaseURL string
	AuthStyle      string
}

var aiProviderDefinitions = map[string]aiProviderDefinition{
	aiProviderDeepSeek: {
		Label:          "DeepSeek",
		DefaultBaseURL: "https://api.deepseek.com/v1",
		AuthStyle:      "openai",
	},
	aiProviderOpenAI: {
		Label:          "OpenAI",
		DefaultBaseURL: "https://api.openai.com/v1",
		AuthStyle:      "openai",
	},
	aiProviderDoubao: {
		Label:          "豆包",
		DefaultBaseURL: "https://ark.cn-beijing.volces.com/api/v3",
		AuthStyle:      "openai",
	},
	aiProviderClaude: {
		Label:          "Claude",
		DefaultBaseURL: "https://api.anthropic.com/v1",
		AuthStyle:      "anthropic",
	},
}

type createAIKeyRequest struct {
	Provider string `json:"provider"`
	Label    string `json:"label"`
	APIKey   string `json:"apiKey"`
	BaseURL  string `json:"baseUrl"`
	Model    string `json:"model"`
}

type aiKeyResponse struct {
	ID             string     `json:"id"`
	Provider       string     `json:"provider"`
	Label          string     `json:"label"`
	APIKey         string     `json:"apiKey,omitempty"`
	KeyHint        string     `json:"keyHint"`
	BaseURL        string     `json:"baseUrl"`
	Model          string     `json:"model"`
	LastVerifiedAt *time.Time `json:"lastVerifiedAt,omitempty"`
	LastUsedAt     *time.Time `json:"lastUsedAt,omitempty"`
	CreatedAt      time.Time  `json:"createdAt"`
}

func (s *server) handleAIKeys(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requireUser(w, r)
	if !ok {
		return
	}
	remainder := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/ai-keys"), "/")
	if remainder == "" {
		switch r.Method {
		case http.MethodGet:
			s.listAIKeys(w, r, user.ID)
		case http.MethodPost:
			s.createAIKey(w, r, user.ID)
		default:
			writeError(w, http.StatusMethodNotAllowed, "不支持的请求方法")
		}
		return
	}
	parts := strings.Split(remainder, "/")
	if len(parts) == 1 && r.Method == http.MethodPost && parts[0] == "test" {
		s.testAIKeyDraft(w, r)
		return
	}
	if len(parts) == 2 && r.Method == http.MethodPost && parts[1] == "verify" {
		s.verifyAIKey(w, r, user.ID, parts[0])
		return
	}
	if len(parts) == 1 && r.Method == http.MethodDelete {
		s.deleteAIKey(w, r, user.ID, parts[0])
		return
	}
	writeError(w, http.StatusNotFound, "AI 密钥接口不存在")
}

func (s *server) listAIKeys(w http.ResponseWriter, r *http.Request, userID uint64) {
	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	items, err := infrastructuremysql.NewAIKeyRepository(s.orm).ListForUser(ctx, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取 AI 密钥失败")
		return
	}
	keys := make([]aiKeyResponse, 0, len(items))
	for _, item := range items {
		keys = append(keys, aiKeyResponse{
			ID: item.ID, Provider: item.Provider, Label: item.Label, APIKey: item.KeyCiphertext, KeyHint: item.KeyHint,
			BaseURL: item.BaseURL, Model: item.Model, LastVerifiedAt: item.LastVerifiedAt, LastUsedAt: item.LastUsedAt, CreatedAt: item.CreatedAt,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"keys": keys})
}

func (s *server) createAIKey(w http.ResponseWriter, r *http.Request, userID uint64) {
	var request createAIKeyRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "请求格式不正确")
		return
	}
	provider, label, apiKey, baseURL, model, err := normalizeAIKeyRequest(request)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	keyID, err := newOpaqueID("ai-key")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "生成 AI 密钥编号失败")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存 AI 密钥失败")
		return
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO ai_api_keys (id, user_id, provider, label, key_ciphertext, key_hint, base_url, model)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		keyID, userID, provider, label, apiKey, maskAPIKey(apiKey), baseURL, model); err != nil {
		writeError(w, http.StatusInternalServerError, "保存 AI 密钥失败")
		return
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "保存 AI 密钥失败")
		return
	}
	writeJSON(w, http.StatusCreated, aiKeyResponse{
		ID: keyID, Provider: provider, Label: label, APIKey: apiKey, KeyHint: maskAPIKey(apiKey), BaseURL: baseURL,
		Model: model, CreatedAt: time.Now(),
	})
}

func (s *server) verifyAIKey(w http.ResponseWriter, r *http.Request, userID uint64, keyID string) {
	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()
	key, err := infrastructuremysql.NewAIKeyRepository(s.orm).FindForUser(ctx, userID, keyID)
	if errors.Is(err, infrastructuremysql.ErrNotFound) {
		writeError(w, http.StatusNotFound, "AI 密钥不存在")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取 AI 密钥失败")
		return
	}
	if err := verifyAIKeyConfiguration(ctx, key.Provider, key.KeyCiphertext, key.BaseURL, key.Model); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	verifiedAt := time.Now()
	if _, err := s.db.ExecContext(ctx, `UPDATE ai_api_keys SET last_verified_at = ? WHERE id = ? AND user_id = ?`, verifiedAt, keyID, userID); err != nil {
		writeError(w, http.StatusInternalServerError, "保存验证结果失败")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "密钥验证通过", "lastVerifiedAt": verifiedAt})
}

func (s *server) testAIKeyDraft(w http.ResponseWriter, r *http.Request) {
	var request createAIKeyRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "请求格式不正确")
		return
	}
	provider, _, apiKey, baseURL, model, err := normalizeAIKeyRequest(request)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()
	if err := verifyAIKeyConfiguration(ctx, provider, apiKey, baseURL, model); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "测试通过，当前密钥和模型可用。"})
}

func (s *server) deleteAIKey(w http.ResponseWriter, r *http.Request, userID uint64, keyID string) {
	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "删除 AI 密钥失败")
		return
	}
	defer tx.Rollback()
	var projectCount int
	err = tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM projects WHERE owner_id = ? AND default_ai_key_id = ?`, userID, keyID).Scan(&projectCount)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "AI 密钥不存在")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "删除 AI 密钥失败")
		return
	}
	if projectCount > 0 {
		writeError(w, http.StatusBadRequest, "该 AI 密钥正在被项目使用，请先修改项目审查 AI")
		return
	}
	var exists bool
	if err := tx.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM ai_api_keys WHERE id = ? AND user_id = ?)`, keyID, userID).Scan(&exists); err != nil || !exists {
		writeError(w, http.StatusNotFound, "AI 密钥不存在")
		return
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM ai_api_keys WHERE id = ? AND user_id = ?`, keyID, userID); err != nil {
		writeError(w, http.StatusInternalServerError, "删除 AI 密钥失败")
		return
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "删除 AI 密钥失败")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func normalizeAIKeyRequest(request createAIKeyRequest) (provider, label, apiKey, baseURL, model string, err error) {
	provider = strings.TrimSpace(request.Provider)
	if provider == "openai_compatible" {
		provider = aiProviderOpenAI
	}
	label = strings.TrimSpace(request.Label)
	apiKey = strings.TrimSpace(request.APIKey)
	baseURL = strings.TrimRight(strings.TrimSpace(request.BaseURL), "/")
	model = strings.TrimSpace(request.Model)
	definition, ok := aiProviderDefinitions[provider]
	if !ok {
		err = fmt.Errorf("请选择支持的 AI 服务")
		return
	}
	if baseURL == "" {
		baseURL = definition.DefaultBaseURL
	}
	if model == "" {
		err = fmt.Errorf("请输入模型名称")
		return
	}
	if label == "" {
		label = definition.Label
	}
	if len([]rune(label)) > 120 || len([]rune(model)) == 0 || len([]rune(model)) > 120 || len(apiKey) < 8 {
		err = fmt.Errorf("请填写有效的密钥名称、模型和 API Key")
		return
	}
	parsed, parseErr := url.ParseRequestURI(baseURL)
	if parseErr != nil || (parsed.Scheme != "https" && parsed.Scheme != "http") || parsed.Host == "" {
		err = fmt.Errorf("请输入有效的 AI 服务地址")
		return
	}
	return
}

func verifyAIKeyConfiguration(ctx context.Context, provider, apiKey, baseURL, model string) error {
	if model == "" {
		return fmt.Errorf("请输入模型名称")
	}
	request, err := newAIProbeRequest(ctx, provider, apiKey, baseURL, model)
	if err != nil {
		return fmt.Errorf("AI 服务地址不正确")
	}
	response, err := (&http.Client{Timeout: 20 * time.Second}).Do(request)
	if err != nil {
		return fmt.Errorf("无法连接 AI 服务，请检查地址、模型和网络")
	}
	defer response.Body.Close()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("AI 服务未接受此密钥或模型，请检查 API Key、服务地址和模型名称")
	}
	return nil
}

func newAIProbeRequest(ctx context.Context, provider, apiKey, baseURL, model string) (*http.Request, error) {
	if provider == "openai_compatible" {
		provider = aiProviderOpenAI
	}
	definition, ok := aiProviderDefinitions[provider]
	if !ok {
		return nil, fmt.Errorf("unsupported provider")
	}
	var endpoint string
	var payload any
	if definition.AuthStyle == "anthropic" {
		endpoint = strings.TrimRight(baseURL, "/") + "/messages"
		payload = map[string]any{
			"model":      model,
			"max_tokens": 8,
			"messages": []map[string]string{
				{"role": "user", "content": "ping"},
			},
		}
	} else {
		endpoint = strings.TrimRight(baseURL, "/") + "/chat/completions"
		payload = map[string]any{
			"model":       model,
			"max_tokens":  8,
			"temperature": 0,
			"messages": []map[string]string{
				{"role": "user", "content": "ping"},
			},
		}
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	request.Header.Set("Content-Type", "application/json")
	if definition.AuthStyle == "anthropic" {
		request.Header.Set("x-api-key", apiKey)
		request.Header.Set("anthropic-version", "2023-06-01")
		return request, nil
	}
	request.Header.Set("Authorization", "Bearer "+apiKey)
	return request, nil
}

func maskAPIKey(apiKey string) string {
	if len(apiKey) <= 4 {
		return "****"
	}
	return "****" + apiKey[len(apiKey)-4:]
}

type aiKeyScanner interface {
	Scan(dest ...any) error
}

func scanAIKey(scanner aiKeyScanner) (aiKeyResponse, error) {
	var key aiKeyResponse
	var lastVerifiedAt, lastUsedAt sql.NullTime
	err := scanner.Scan(&key.ID, &key.Provider, &key.Label, &key.APIKey, &key.KeyHint, &key.BaseURL, &key.Model, &lastVerifiedAt, &lastUsedAt, &key.CreatedAt)
	if err != nil {
		return key, err
	}
	if lastVerifiedAt.Valid {
		value := lastVerifiedAt.Time
		key.LastVerifiedAt = &value
	}
	if lastUsedAt.Valid {
		value := lastUsedAt.Time
		key.LastUsedAt = &value
	}
	return key, nil
}
