package aikey

import (
	"errors"
	"net/http"
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

type keyResponse struct {
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

func (h *Handler) List(w http.ResponseWriter, r *http.Request, userID uint64) error {
	keys, err := h.service.List(r.Context(), userID)
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

func (h *Handler) Create(w http.ResponseWriter, r *http.Request, userID uint64) error {
	var input saveKeyRequest
	if err := decodeJSON(r, &input); err != nil {
		return err
	}
	key, err := h.service.Create(r.Context(), userID, input.Provider, input.Label, input.APIKey, input.BaseURL, input.Model)
	if err != nil {
		return fault.New(fault.InvalidRequest, err.Error())
	}
	httpresponse.WriteJSON(w, http.StatusCreated, keyResponseFromApplication(key))
	return nil
}

func (h *Handler) Verify(w http.ResponseWriter, r *http.Request, userID uint64, keyID string) error {
	verified, err := h.service.Verify(r.Context(), userID, keyID)
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

func (h *Handler) Test(w http.ResponseWriter, r *http.Request) error {
	var input saveKeyRequest
	if err := decodeJSON(r, &input); err != nil {
		return err
	}
	if err := h.service.Test(r.Context(), input.Provider, input.Label, input.APIKey, input.BaseURL, input.Model); err != nil {
		return fault.New(fault.InvalidRequest, err.Error())
	}
	httpresponse.WriteJSON(w, http.StatusOK, map[string]string{"message": "测试通过，当前密钥和模型可用。"})
	return nil
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request, userID uint64, keyID string) error {
	err := h.service.Delete(r.Context(), userID, keyID)
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
	return keyResponse{ID: key.ID, Provider: key.Provider, Label: key.Label, APIKey: key.APIKey, KeyHint: key.KeyHint, BaseURL: key.BaseURL, Model: key.Model, LastVerifiedAt: key.LastVerifiedAt, LastUsedAt: key.LastUsedAt, CreatedAt: key.CreatedAt}
}

func decodeJSON(r *http.Request, target any) error {
	if err := httprequest.DecodeJSON(r, target); err != nil {
		return fault.New(fault.InvalidRequest, "请求格式不正确")
	}
	return nil
}
