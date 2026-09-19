package endpoint

import (
	"context"
	"errors"
	"net/http"
	"strings"

	applicationproject "github.com/singaurora/exec-graph/backend/internal/application/project"
)

type setProjectAIKeyRequest struct {
	AIKeyID string `json:"aiKeyId"`
}

func (s *Server) setProjectAIKey(w http.ResponseWriter, r *http.Request, userID uint64, projectID string) {
	var request setProjectAIKeyRequest
	if !bindJSON(w, r, &request) {
		return
	}
	keyID := strings.TrimSpace(request.AIKeyID)
	if keyID == "" {
		writeError(w, http.StatusBadRequest, "请选择项目审查 AI")
		return
	}
	if err := s.project.SetAIKey(r.Context(), userID, projectID, keyID); err != nil {
		writeError(w, http.StatusBadRequest, "AI 密钥不可用，或项目已归档")
		return
	}
	project, err := s.project.Get(r.Context(), userID, projectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取项目失败")
		return
	}
	writeJSON(w, http.StatusOK, project)
}

func (s *Server) setProjectSmartContract(w http.ResponseWriter, r *http.Request, userID uint64, projectID string) {
	var request struct {
		SmartContractID string `json:"smartContractId"`
	}
	if !bindJSON(w, r, &request) {
		return
	}
	contractID := strings.TrimSpace(request.SmartContractID)
	if contractID == "" {
		writeError(w, http.StatusBadRequest, "请选择项目智能合约")
		return
	}
	project, err := s.project.SetContract(r.Context(), userID, projectID, contractID)
	if errors.Is(err, applicationproject.ErrNotFound) {
		writeError(w, http.StatusNotFound, "项目不存在、已归档或无权修改")
		return
	}
	if errors.Is(err, applicationproject.ErrInvalidContract) {
		writeError(w, http.StatusBadRequest, "规则引导型项目或协作贡献项目不能更换智能合约")
		return
	}
	if errors.Is(err, applicationproject.ErrContractUnavailable) {
		writeError(w, http.StatusBadRequest, "智能合约不存在或不可用")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存项目智能合约失败")
		return
	}
	writeJSON(w, http.StatusOK, project)
}

func (s *Server) archiveProject(w http.ResponseWriter, r *http.Request, userID uint64, projectID string) {
	if err := s.project.Archive(r.Context(), userID, projectID); err != nil {
		if errors.Is(err, applicationproject.ErrAlreadyArchived) {
			writeError(w, http.StatusBadRequest, "项目不存在或已经归档")
		} else {
			writeError(w, http.StatusInternalServerError, "归档项目失败")
		}
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "项目已归档"})
}

func (s *Server) unarchiveProject(w http.ResponseWriter, r *http.Request, userID uint64, projectID string) {
	if err := s.project.Unarchive(r.Context(), userID, projectID); err != nil {
		if errors.Is(err, applicationproject.ErrNotArchived) {
			writeError(w, http.StatusBadRequest, "项目不存在或未归档")
		} else {
			writeError(w, http.StatusInternalServerError, "恢复项目失败")
		}
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "项目已恢复"})
}

func (s *Server) deleteProject(w http.ResponseWriter, r *http.Request, userID uint64, projectID string) {
	err := s.project.Delete(r.Context(), userID, projectID)
	if errors.Is(err, applicationproject.ErrNotFound) {
		writeError(w, http.StatusNotFound, "项目不存在")
		return
	}
	if errors.Is(err, applicationproject.ErrAdoptedContent) {
		writeError(w, http.StatusBadRequest, "项目已有被外部采纳的成果，不能删除；可以归档保留历史")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "删除项目失败")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "项目已删除"})
}

func (s *Server) getProjectGraph(w http.ResponseWriter, r *http.Request, userID uint64, projectID string) {
	s.writeProjectState(r.Context(), w, userID, projectID, http.StatusOK)
}

func (s *Server) writeProjectState(ctx context.Context, w http.ResponseWriter, userID uint64, projectID string, status int) {
	state, err := s.project.State(ctx, userID, projectID)
	if errors.Is(err, applicationproject.ErrNotFound) {
		writeError(w, http.StatusNotFound, "项目不存在")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取项目状态失败")
		return
	}
	writeJSON(w, status, state)
}
