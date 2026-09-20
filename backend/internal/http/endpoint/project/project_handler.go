package project

import (
	"errors"
	"net/http"
	"strings"

	applicationproject "github.com/singaurora/exec-graph/backend/internal/application/project"
	httpresponse "github.com/singaurora/exec-graph/backend/internal/http/response"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
)

// ListOwnedProjects 返回当前用户拥有的项目。
func (h *Handler) ListOwnedProjects(w http.ResponseWriter, r *http.Request, userID uint64) error {
	projects, err := h.service.ListOwnedProjects(r.Context(), userID)
	if err != nil {
		return fault.Wrap(fault.Internal, "读取项目失败", err)
	}
	httpresponse.WriteJSON(w, http.StatusOK, map[string]any{"projects": projects})
	return nil
}

// CreateProject 创建项目及其初始智能合约修订。
func (h *Handler) CreateProject(w http.ResponseWriter, r *http.Request, userID uint64) error {
	var request createProjectRequest
	if err := decodeJSON(r, &request); err != nil {
		return err
	}
	project, err := h.service.CreateProject(r.Context(), applicationproject.CreateInput{
		OwnerID: userID, Title: request.Title, Description: request.Description,
		ProjectType: request.ProjectType, ProjectRules: request.ProjectRules,
		SmartContractID: request.SmartContractUUID, Visibility: request.Visibility,
		AIKeyID: request.AIKeyUUID, ContributionCallID: request.ContributionCallUUID,
	})
	switch {
	case errors.Is(err, applicationproject.ErrInvalidProject):
		return fault.New(fault.InvalidRequest, "项目参数不正确，规则引导型项目的规则至少需要 12 个字符")
	case errors.Is(err, applicationproject.ErrAIKeyUnavailable):
		return fault.New(fault.InvalidRequest, "项目审查 AI 不存在或不可用")
	case errors.Is(err, applicationproject.ErrContractUnavailable):
		return fault.New(fault.InvalidRequest, "智能合约不存在或不可用")
	case errors.Is(err, applicationproject.ErrCallUnavailable):
		return fault.New(fault.InvalidRequest, "这个开放缺口当前不能开始新的贡献")
	case err != nil:
		return fault.Wrap(fault.Internal, "创建项目失败", err)
	default:
		httpresponse.WriteJSON(w, http.StatusCreated, project)
		return nil
	}
}

// GetProjectDetail 返回项目资料和当前合约信息，不包含完整执行图。
func (h *Handler) GetProjectDetail(w http.ResponseWriter, r *http.Request, userID uint64) error {
	projectUUID := strings.TrimSpace(r.URL.Query().Get("projectUuid"))
	if projectUUID == "" {
		return fault.New(fault.InvalidRequest, "缺少项目 UUID")
	}
	project, err := h.service.GetOwnedProject(r.Context(), userID, projectUUID)
	if errors.Is(err, applicationproject.ErrNotFound) {
		return fault.New(fault.NotFound, "项目不存在")
	}
	if err != nil {
		return fault.Wrap(fault.Internal, "读取项目失败", err)
	}
	httpresponse.WriteJSON(w, http.StatusOK, project)
	return nil
}

// UpdateProjectProfile 更新项目名称、说明和可见性。
func (h *Handler) UpdateProjectProfile(w http.ResponseWriter, r *http.Request, userID uint64) error {
	var request updateProjectRequest
	if err := decodeJSON(r, &request); err != nil {
		return err
	}
	title := strings.TrimSpace(request.Title)
	description := strings.TrimSpace(request.Description)
	if title == "" {
		return fault.New(fault.InvalidRequest, "项目名称不能为空")
	}
	if len([]rune(title)) > 160 || len([]rune(description)) > 2000 {
		return fault.New(fault.InvalidRequest, "项目名称或描述过长")
	}
	if request.Visibility != "private" && request.Visibility != "public" {
		return fault.New(fault.InvalidRequest, "项目可见性不正确")
	}
	projectUUID := strings.TrimSpace(request.ProjectUUID)
	if projectUUID == "" {
		return fault.New(fault.InvalidRequest, "缺少项目 UUID")
	}
	if err := h.service.UpdateProjectProfile(r.Context(), userID, projectUUID, title, description, request.Visibility); err != nil {
		if errors.Is(err, applicationproject.ErrAdoptedContent) {
			return fault.New(fault.Conflict, "项目已有被外部采纳的公开成果，不能改为私人项目")
		}
		if errors.Is(err, applicationproject.ErrNotFound) {
			return fault.New(fault.NotFound, "项目不存在或已归档")
		}
		return fault.Wrap(fault.Internal, "保存项目资料失败", err)
	}
	return h.writeState(r.Context(), w, userID, projectUUID, http.StatusOK)
}

// SetProjectReviewAI 设置项目后续审查使用的 AI 密钥。
func (h *Handler) SetProjectReviewAI(w http.ResponseWriter, r *http.Request, userID uint64) error {
	var request setAIKeyRequest
	if err := decodeJSON(r, &request); err != nil {
		return err
	}
	projectUUID := strings.TrimSpace(request.ProjectUUID)
	keyUUID := strings.TrimSpace(request.AIKeyUUID)
	if projectUUID == "" {
		return fault.New(fault.InvalidRequest, "缺少项目 UUID")
	}
	if keyUUID == "" {
		return fault.New(fault.InvalidRequest, "请选择项目审查 AI")
	}
	if err := h.service.SetProjectReviewAI(r.Context(), userID, projectUUID, keyUUID); err != nil {
		return fault.New(fault.InvalidRequest, "AI 密钥不可用，或项目已归档")
	}
	project, err := h.service.GetOwnedProject(r.Context(), userID, projectUUID)
	if err != nil {
		return fault.Wrap(fault.Internal, "读取项目失败", err)
	}
	httpresponse.WriteJSON(w, http.StatusOK, project)
	return nil
}

// SetProjectSmartContract 为自主推进项目切换智能合约。
func (h *Handler) SetProjectSmartContract(w http.ResponseWriter, r *http.Request, userID uint64) error {
	var request setSmartContractRequest
	if err := decodeJSON(r, &request); err != nil {
		return err
	}
	projectUUID := strings.TrimSpace(request.ProjectUUID)
	contractUUID := strings.TrimSpace(request.SmartContractUUID)
	if projectUUID == "" {
		return fault.New(fault.InvalidRequest, "缺少项目 UUID")
	}
	if contractUUID == "" {
		return fault.New(fault.InvalidRequest, "请选择项目智能合约")
	}
	project, err := h.service.SetProjectSmartContract(r.Context(), userID, projectUUID, contractUUID)
	switch {
	case errors.Is(err, applicationproject.ErrNotFound):
		return fault.New(fault.NotFound, "项目不存在、已归档或无权修改")
	case errors.Is(err, applicationproject.ErrInvalidContract):
		return fault.New(fault.InvalidRequest, "规则引导型项目或协作贡献项目不能更换智能合约")
	case errors.Is(err, applicationproject.ErrContractUnavailable):
		return fault.New(fault.InvalidRequest, "智能合约不存在或不可用")
	case err != nil:
		return fault.Wrap(fault.Internal, "保存项目智能合约失败", err)
	default:
		httpresponse.WriteJSON(w, http.StatusOK, project)
		return nil
	}
}

// ArchiveProject 停止项目继续推进，同时保留历史数据。
func (h *Handler) ArchiveProject(w http.ResponseWriter, r *http.Request, userID uint64) error {
	var request projectCommandRequest
	if err := decodeJSON(r, &request); err != nil {
		return err
	}
	projectUUID := strings.TrimSpace(request.ProjectUUID)
	if projectUUID == "" {
		return fault.New(fault.InvalidRequest, "缺少项目 UUID")
	}
	if err := h.service.ArchiveProject(r.Context(), userID, projectUUID); err != nil {
		if errors.Is(err, applicationproject.ErrAlreadyArchived) {
			return fault.New(fault.InvalidRequest, "项目不存在或已经归档")
		}
		return fault.Wrap(fault.Internal, "归档项目失败", err)
	}
	httpresponse.WriteJSON(w, http.StatusOK, map[string]string{"message": "项目已归档"})
	return nil
}

// RestoreArchivedProject 恢复一个已归档项目。
func (h *Handler) RestoreArchivedProject(w http.ResponseWriter, r *http.Request, userID uint64) error {
	var request projectCommandRequest
	if err := decodeJSON(r, &request); err != nil {
		return err
	}
	projectUUID := strings.TrimSpace(request.ProjectUUID)
	if projectUUID == "" {
		return fault.New(fault.InvalidRequest, "缺少项目 UUID")
	}
	if err := h.service.RestoreArchivedProject(r.Context(), userID, projectUUID); err != nil {
		if errors.Is(err, applicationproject.ErrNotArchived) {
			return fault.New(fault.InvalidRequest, "项目不存在或未归档")
		}
		return fault.Wrap(fault.Internal, "恢复项目失败", err)
	}
	httpresponse.WriteJSON(w, http.StatusOK, map[string]string{"message": "项目已恢复"})
	return nil
}

// DeleteProject 删除没有外部采纳关系的项目及其执行数据。
func (h *Handler) DeleteProject(w http.ResponseWriter, r *http.Request, userID uint64) error {
	var request projectCommandRequest
	if err := decodeJSON(r, &request); err != nil {
		return err
	}
	projectUUID := strings.TrimSpace(request.ProjectUUID)
	if projectUUID == "" {
		return fault.New(fault.InvalidRequest, "缺少项目 UUID")
	}
	err := h.service.DeleteProject(r.Context(), userID, projectUUID)
	switch {
	case errors.Is(err, applicationproject.ErrNotFound):
		return fault.New(fault.NotFound, "项目不存在")
	case errors.Is(err, applicationproject.ErrAdoptedContent):
		return fault.New(fault.Conflict, "项目已有被外部采纳的成果，不能删除；可以归档保留历史")
	case err != nil:
		return fault.Wrap(fault.Internal, "删除项目失败", err)
	default:
		httpresponse.WriteJSON(w, http.StatusOK, map[string]string{"message": "项目已删除"})
		return nil
	}
}

// GetProjectExecutionGraph 返回项目资料、节点、边、分支和完成记录组成的完整执行状态。
func (h *Handler) GetProjectExecutionGraph(w http.ResponseWriter, r *http.Request, userID uint64) error {
	projectUUID := strings.TrimSpace(r.URL.Query().Get("projectUuid"))
	if projectUUID == "" {
		return fault.New(fault.InvalidRequest, "缺少项目 UUID")
	}
	return h.writeState(r.Context(), w, userID, projectUUID, http.StatusOK)
}
