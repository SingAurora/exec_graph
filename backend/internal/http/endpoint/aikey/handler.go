package aikey

import (
	"errors"
	"net/http"
	"strings"
	"time"

	applicationaikey "github.com/singaurora/exec-graph/backend/internal/application/aikey"
	httprequest "github.com/singaurora/exec-graph/backend/internal/http/request"
	httpresponse "github.com/singaurora/exec-graph/backend/internal/http/response"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
)

// Handler 负责 AI 密钥 HTTP 接口的协议适配。
type Handler struct {
	service *applicationaikey.Service
}

func New(service *applicationaikey.Service) *Handler {
	return &Handler{service: service}
}

type saveKeyRequest struct {
	Provider string `json:"provider"`
	Label    string `json:"label"`
	APIKey   string `json:"apiKey"`
	BaseURL  string `json:"baseUrl"`
	Model    string `json:"model"`
}

type savedKeyCommandRequest struct {
	KeyUUID string `json:"keyUuid"`
}

type keyResponse struct {
	ID             string     `json:"uuid"`
	Provider       string     `json:"provider"`
	Label          string     `json:"label"`
	KeyHint        string     `json:"keyHint"`
	BaseURL        string     `json:"baseUrl"`
	Model          string     `json:"model"`
	LastVerifiedAt *time.Time `json:"lastVerifiedAt,omitempty"`
	LastUsedAt     *time.Time `json:"lastUsedAt,omitempty"`
	CreatedAt      time.Time  `json:"createdAt"`
}

// ListAIKeys 返回当前用户保存的 AI 服务配置。
func (h *Handler) ListAIKeys(w http.ResponseWriter, r *http.Request, userID uint64) error {
	keys, err := h.service.ListAIKeys(r.Context(), userID)
	if err != nil {
		return fault.Wrap(fault.Internal, "读取 AI 密钥失败", err)
	}
	result := make([]keyResponse, 0, len(keys))
	for _, key := range keys {
		result = append(result, keyResponseFromApplication(key))
	}
	httpresponse.WriteJSON(w, http.StatusOK, map[string]any{"keys": result})
	return nil
}

// CreateAIKey 验证并保存一份 AI 服务配置。
func (h *Handler) CreateAIKey(w http.ResponseWriter, r *http.Request, userID uint64) error {
	var input saveKeyRequest
	if err := decodeJSON(r, &input); err != nil {
		return err
	}
	key, err := h.service.CreateAIKey(r.Context(), userID, input.Provider, input.Label, input.APIKey, input.BaseURL, input.Model)
	if err != nil {
		return fault.New(fault.InvalidRequest, err.Error())
	}
	httpresponse.WriteJSON(w, http.StatusCreated, keyResponseFromApplication(key))
	return nil
}

// VerifySavedAIKey 重新验证一份已经保存的 AI 服务配置。
func (h *Handler) VerifySavedAIKey(w http.ResponseWriter, r *http.Request, userID uint64) error {
	var input savedKeyCommandRequest
	if err := decodeJSON(r, &input); err != nil {
		return err
	}
	keyUUID := strings.TrimSpace(input.KeyUUID)
	if keyUUID == "" {
		return fault.New(fault.InvalidRequest, "缺少 AI 密钥 UUID")
	}
	verified, err := h.service.VerifySavedAIKey(r.Context(), userID, keyUUID)
	switch {
	case errors.Is(err, applicationaikey.ErrNotFound):
		return fault.New(fault.NotFound, "AI 密钥不存在")
	case err != nil:
		return fault.New(fault.InvalidRequest, err.Error())
	default:
		httpresponse.WriteJSON(w, http.StatusOK, map[string]any{"message": "密钥验证通过", "lastVerifiedAt": verified})
		return nil
	}
}

// TestAIKeyConfiguration 验证一份尚未保存的 AI 服务配置。
func (h *Handler) TestAIKeyConfiguration(w http.ResponseWriter, r *http.Request) error {
	var input saveKeyRequest
	if err := decodeJSON(r, &input); err != nil {
		return err
	}
	if err := h.service.TestAIKeyConfiguration(r.Context(), input.Provider, input.Label, input.APIKey, input.BaseURL, input.Model); err != nil {
		return fault.New(fault.InvalidRequest, err.Error())
	}
	httpresponse.WriteJSON(w, http.StatusOK, map[string]string{"message": "测试通过，当前密钥和模型可用。"})
	return nil
}

// DeleteAIKey 删除一份未被项目使用的 AI 密钥。
func (h *Handler) DeleteAIKey(w http.ResponseWriter, r *http.Request, userID uint64) error {
	var input savedKeyCommandRequest
	if err := decodeJSON(r, &input); err != nil {
		return err
	}
	keyUUID := strings.TrimSpace(input.KeyUUID)
	if keyUUID == "" {
		return fault.New(fault.InvalidRequest, "缺少 AI 密钥 UUID")
	}
	err := h.service.DeleteAIKey(r.Context(), userID, keyUUID)
	switch {
	case errors.Is(err, applicationaikey.ErrNotFound):
		return fault.New(fault.NotFound, "AI 密钥不存在")
	case errors.Is(err, applicationaikey.ErrInUse):
		return fault.New(fault.Conflict, "该 AI 密钥正在被项目使用，请先修改项目审查 AI")
	case err != nil:
		return fault.Wrap(fault.Internal, "删除 AI 密钥失败", err)
	default:
		httpresponse.WriteJSON(w, http.StatusOK, nil)
		return nil
	}
}

func keyResponseFromApplication(key applicationaikey.Key) keyResponse {
	return keyResponse{ID: key.ID, Provider: key.Provider, Label: key.Label, KeyHint: key.KeyHint, BaseURL: key.BaseURL, Model: key.Model, LastVerifiedAt: key.LastVerifiedAt, LastUsedAt: key.LastUsedAt, CreatedAt: key.CreatedAt}
}

func decodeJSON(r *http.Request, target any) error {
	if err := httprequest.DecodeJSON(r, target); err != nil {
		return fault.New(fault.InvalidRequest, "请求格式不正确")
	}
	return nil
}
