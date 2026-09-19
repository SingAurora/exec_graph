package endpoint

import (
	"errors"
	"net/http"

	applicationaikey "github.com/singaurora/exec-graph/backend/internal/application/aikey"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
)

func aiKeyResponseFromApplication(key applicationaikey.Key) aiKeyResponse {
	return aiKeyResponse{ID: key.ID, Provider: key.Provider, Label: key.Label, APIKey: key.APIKey, KeyHint: key.KeyHint, BaseURL: key.BaseURL, Model: key.Model, LastVerifiedAt: key.LastVerifiedAt, LastUsedAt: key.LastUsedAt, CreatedAt: key.CreatedAt}
}

func (s *Server) listAIKeysApplication(w http.ResponseWriter, r *http.Request, userID uint64) error {
	keys, err := s.aiKey.List(r.Context(), userID)
	if err != nil {
		return fault.Wrap(fault.Internal, "读取 AI 密钥失败", err)
	}
	result := make([]aiKeyResponse, 0, len(keys))
	for _, key := range keys {
		result = append(result, aiKeyResponseFromApplication(key))
	}
	writeJSON(w, http.StatusOK, map[string]any{"keys": result})
	return nil
}

func (s *Server) createAIKeyApplication(w http.ResponseWriter, r *http.Request, userID uint64) error {
	var input createAIKeyRequest
	if err := decodeJSON(r, &input); err != nil {
		return err
	}
	key, err := s.aiKey.Create(r.Context(), userID, input.Provider, input.Label, input.APIKey, input.BaseURL, input.Model)
	if err != nil {
		return fault.New(fault.InvalidRequest, err.Error())
	}
	writeJSON(w, http.StatusCreated, aiKeyResponseFromApplication(key))
	return nil
}

func (s *Server) verifyAIKeyApplication(w http.ResponseWriter, r *http.Request, userID uint64, keyID string) error {
	verified, err := s.aiKey.Verify(r.Context(), userID, keyID)
	if errors.Is(err, applicationaikey.ErrNotFound) {
		return fault.New(fault.NotFound, "AI 密钥不存在")
	} else if err != nil {
		return fault.New(fault.InvalidRequest, err.Error())
	} else {
		writeJSON(w, http.StatusOK, map[string]any{"message": "密钥验证通过", "lastVerifiedAt": verified})
		return nil
	}
}

func (s *Server) testAIKeyApplication(w http.ResponseWriter, r *http.Request) error {
	var input createAIKeyRequest
	if err := decodeJSON(r, &input); err != nil {
		return err
	}
	if err := s.aiKey.Test(r.Context(), input.Provider, input.Label, input.APIKey, input.BaseURL, input.Model); err != nil {
		return fault.New(fault.InvalidRequest, err.Error())
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "测试通过，当前密钥和模型可用。"})
	return nil
}

func (s *Server) deleteAIKeyApplication(w http.ResponseWriter, r *http.Request, userID uint64, keyID string) error {
	err := s.aiKey.Delete(r.Context(), userID, keyID)
	switch {
	case errors.Is(err, applicationaikey.ErrNotFound):
		return fault.New(fault.NotFound, "AI 密钥不存在")
	case errors.Is(err, applicationaikey.ErrInUse):
		return fault.New(fault.Conflict, "该 AI 密钥正在被项目使用，请先修改项目审查 AI")
	case err != nil:
		return fault.Wrap(fault.Internal, "删除 AI 密钥失败", err)
	default:
		writeJSON(w, http.StatusOK, nil)
		return nil
	}
}
