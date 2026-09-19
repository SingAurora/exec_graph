package endpoint

import (
	"errors"
	"net/http"

	applicationaikey "github.com/singaurora/exec-graph/backend/internal/application/aikey"
)

func aiKeyResponseFromApplication(key applicationaikey.Key) aiKeyResponse {
	return aiKeyResponse{ID: key.ID, Provider: key.Provider, Label: key.Label, APIKey: key.APIKey, KeyHint: key.KeyHint, BaseURL: key.BaseURL, Model: key.Model, LastVerifiedAt: key.LastVerifiedAt, LastUsedAt: key.LastUsedAt, CreatedAt: key.CreatedAt}
}

func (s *Server) listAIKeysApplication(w http.ResponseWriter, r *http.Request, userID uint64) {
	keys, err := s.aiKey.List(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取 AI 密钥失败")
		return
	}
	result := make([]aiKeyResponse, 0, len(keys))
	for _, key := range keys {
		result = append(result, aiKeyResponseFromApplication(key))
	}
	writeJSON(w, http.StatusOK, map[string]any{"keys": result})
}

func (s *Server) createAIKeyApplication(w http.ResponseWriter, r *http.Request, userID uint64) {
	var input createAIKeyRequest
	if !bindJSON(w, r, &input) {
		return
	}
	key, err := s.aiKey.Create(r.Context(), userID, input.Provider, input.Label, input.APIKey, input.BaseURL, input.Model)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, aiKeyResponseFromApplication(key))
}

func (s *Server) verifyAIKeyApplication(w http.ResponseWriter, r *http.Request, userID uint64, keyID string) {
	verified, err := s.aiKey.Verify(r.Context(), userID, keyID)
	if errors.Is(err, applicationaikey.ErrNotFound) {
		writeError(w, http.StatusNotFound, "AI 密钥不存在")
	} else if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
	} else {
		writeJSON(w, http.StatusOK, map[string]any{"message": "密钥验证通过", "lastVerifiedAt": verified})
	}
}

func (s *Server) testAIKeyApplication(w http.ResponseWriter, r *http.Request) {
	var input createAIKeyRequest
	if !bindJSON(w, r, &input) {
		return
	}
	if err := s.aiKey.Test(r.Context(), input.Provider, input.Label, input.APIKey, input.BaseURL, input.Model); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "测试通过，当前密钥和模型可用。"})
}

func (s *Server) deleteAIKeyApplication(w http.ResponseWriter, r *http.Request, userID uint64, keyID string) {
	err := s.aiKey.Delete(r.Context(), userID, keyID)
	switch {
	case errors.Is(err, applicationaikey.ErrNotFound):
		writeError(w, http.StatusNotFound, "AI 密钥不存在")
	case errors.Is(err, applicationaikey.ErrInUse):
		writeError(w, http.StatusBadRequest, "该 AI 密钥正在被项目使用，请先修改项目审查 AI")
	case err != nil:
		writeError(w, http.StatusInternalServerError, "删除 AI 密钥失败")
	default:
		w.WriteHeader(http.StatusNoContent)
	}
}
