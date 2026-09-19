package endpoint

import (
	"context"
	"errors"
	"net/http"
	"strings"

	applicationproject "github.com/singaurora/exec-graph/backend/internal/application/project"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
)

type setProjectAIKeyRequest struct {
	AIKeyID string `json:"aiKeyId"`
}

func (s *Server) setProjectAIKey(w http.ResponseWriter, r *http.Request, userID uint64, projectID string) error {
	var request setProjectAIKeyRequest
	if err := decodeJSON(r, &request); err != nil {
		return err
	}
	keyID := strings.TrimSpace(request.AIKeyID)
	if keyID == "" {
		return fault.New(fault.InvalidRequest, "请选择项目审查 AI")
	}
	if err := s.project.SetAIKey(r.Context(), userID, projectID, keyID); err != nil {
		return fault.New(fault.InvalidRequest, "AI 密钥不可用，或项目已归档")
	}
	project, err := s.project.Get(r.Context(), userID, projectID)
	if err != nil {
		return fault.Wrap(fault.Internal, "读取项目失败", err)
	}
	writeJSON(w, http.StatusOK, project)
	return nil
}

func (s *Server) setProjectSmartContract(w http.ResponseWriter, r *http.Request, userID uint64, projectID string) error {
	var request struct {
		SmartContractID string `json:"smartContractId"`
	}
	if err := decodeJSON(r, &request); err != nil {
		return err
	}
	contractID := strings.TrimSpace(request.SmartContractID)
	if contractID == "" {
		return fault.New(fault.InvalidRequest, "请选择项目智能合约")
	}
	project, err := s.project.SetContract(r.Context(), userID, projectID, contractID)
	if errors.Is(err, applicationproject.ErrNotFound) {
		return fault.New(fault.NotFound, "项目不存在、已归档或无权修改")
	}
	if errors.Is(err, applicationproject.ErrInvalidContract) {
		return fault.New(fault.InvalidRequest, "规则引导型项目或协作贡献项目不能更换智能合约")
	}
	if errors.Is(err, applicationproject.ErrContractUnavailable) {
		return fault.New(fault.InvalidRequest, "智能合约不存在或不可用")
	}
	if err != nil {
		return fault.Wrap(fault.Internal, "保存项目智能合约失败", err)
	}
	writeJSON(w, http.StatusOK, project)
	return nil
}

func (s *Server) archiveProject(w http.ResponseWriter, r *http.Request, userID uint64, projectID string) error {
	if err := s.project.Archive(r.Context(), userID, projectID); err != nil {
		if errors.Is(err, applicationproject.ErrAlreadyArchived) {
			return fault.New(fault.InvalidRequest, "项目不存在或已经归档")
		}
		return fault.Wrap(fault.Internal, "归档项目失败", err)
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "项目已归档"})
	return nil
}

func (s *Server) unarchiveProject(w http.ResponseWriter, r *http.Request, userID uint64, projectID string) error {
	if err := s.project.Unarchive(r.Context(), userID, projectID); err != nil {
		if errors.Is(err, applicationproject.ErrNotArchived) {
			return fault.New(fault.InvalidRequest, "项目不存在或未归档")
		}
		return fault.Wrap(fault.Internal, "恢复项目失败", err)
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "项目已恢复"})
	return nil
}

func (s *Server) deleteProject(w http.ResponseWriter, r *http.Request, userID uint64, projectID string) error {
	err := s.project.Delete(r.Context(), userID, projectID)
	if errors.Is(err, applicationproject.ErrNotFound) {
		return fault.New(fault.NotFound, "项目不存在")
	}
	if errors.Is(err, applicationproject.ErrAdoptedContent) {
		return fault.New(fault.Conflict, "项目已有被外部采纳的成果，不能删除；可以归档保留历史")
	}
	if err != nil {
		return fault.Wrap(fault.Internal, "删除项目失败", err)
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "项目已删除"})
	return nil
}

func (s *Server) getProjectGraph(w http.ResponseWriter, r *http.Request, userID uint64, projectID string) error {
	return s.writeProjectState(r.Context(), w, userID, projectID, http.StatusOK)
}

func (s *Server) writeProjectState(ctx context.Context, w http.ResponseWriter, userID uint64, projectID string, status int) error {
	state, err := s.project.State(ctx, userID, projectID)
	if errors.Is(err, applicationproject.ErrNotFound) {
		return fault.New(fault.NotFound, "项目不存在")
	}
	if err != nil {
		return fault.Wrap(fault.Internal, "读取项目状态失败", err)
	}
	writeJSON(w, status, state)
	return nil
}
