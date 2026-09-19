package endpoint

import (
	"errors"
	"net/http"
	"strings"

	applicationproject "github.com/singaurora/exec-graph/backend/internal/application/project"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
)

type createProjectRequest struct {
	Title              string `json:"title"`
	Description        string `json:"description"`
	ProjectType        string `json:"projectType"`
	ProjectRules       string `json:"projectRules"`
	SmartContractID    string `json:"smartContractId"`
	Visibility         string `json:"visibility"`
	AIKeyID            string `json:"aiKeyId"`
	ContributionCallID string `json:"contributionCallId"`
}

type updateProjectRequest struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Visibility  string `json:"visibility"`
}

func (s *Server) updateProject(w http.ResponseWriter, r *http.Request, userID uint64, projectID string) error {
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
	if err := s.project.Update(r.Context(), userID, projectID, title, description, request.Visibility); err != nil {
		if errors.Is(err, applicationproject.ErrAdoptedContent) {
			return fault.New(fault.Conflict, "项目已有被外部采纳的公开成果，不能改为私人项目")
		}
		if errors.Is(err, applicationproject.ErrNotFound) {
			return fault.New(fault.NotFound, "项目不存在或已归档")
		}
		return fault.Wrap(fault.Internal, "保存项目资料失败", err)
	}
	return s.writeProjectState(r.Context(), w, userID, projectID, http.StatusOK)
}

func (s *Server) listProjects(w http.ResponseWriter, r *http.Request, userID uint64) error {
	projects, err := s.project.List(r.Context(), userID)
	if err != nil {
		return fault.Wrap(fault.Internal, "读取项目失败", err)
	}
	writeJSON(w, http.StatusOK, map[string]any{"projects": projects})
	return nil
}

func (s *Server) createProject(w http.ResponseWriter, r *http.Request, userID uint64) error {
	var request createProjectRequest
	if err := decodeJSON(r, &request); err != nil {
		return err
	}
	project, err := s.project.Create(r.Context(), applicationproject.CreateInput{
		OwnerID: userID, Title: request.Title, Description: request.Description,
		ProjectType: request.ProjectType, ProjectRules: request.ProjectRules,
		SmartContractID: request.SmartContractID, Visibility: request.Visibility,
		AIKeyID: request.AIKeyID, ContributionCallID: request.ContributionCallID,
	})
	if errors.Is(err, applicationproject.ErrInvalidProject) {
		return fault.New(fault.InvalidRequest, "项目参数不正确，规则引导型项目的规则至少需要 12 个字符")
	}
	if errors.Is(err, applicationproject.ErrAIKeyUnavailable) {
		return fault.New(fault.InvalidRequest, "项目审查 AI 不存在或不可用")
	}
	if errors.Is(err, applicationproject.ErrContractUnavailable) {
		return fault.New(fault.InvalidRequest, "智能合约不存在或不可用")
	}
	if errors.Is(err, applicationproject.ErrCallUnavailable) {
		return fault.New(fault.InvalidRequest, "这个开放缺口当前不能开始新的贡献")
	}
	if err != nil {
		return fault.Wrap(fault.Internal, "创建项目失败", err)
	}
	writeJSON(w, http.StatusCreated, project)
	return nil
}

func (s *Server) getProject(w http.ResponseWriter, r *http.Request, userID uint64, projectID string) error {
	project, err := s.project.Get(r.Context(), userID, projectID)
	if errors.Is(err, applicationproject.ErrNotFound) {
		return fault.New(fault.NotFound, "项目不存在")
	}
	if err != nil {
		return fault.Wrap(fault.Internal, "读取项目失败", err)
	}
	writeJSON(w, http.StatusOK, project)
	return nil
}

func (s *Server) listSmartContracts(w http.ResponseWriter, r *http.Request, userID uint64) error {
	items, err := s.project.ListContracts(r.Context(), userID)
	if err != nil {
		return fault.Wrap(fault.Internal, "读取智能合约失败", err)
	}
	contracts := make([]smartContractResponse, 0, len(items))
	for _, item := range items {
		contracts = append(contracts, smartContractResponse{ID: item.ID, Name: item.Name, Source: item.Source, Version: item.Version, Description: item.Description, Body: item.Body, CreatedAt: item.CreatedAt})
	}
	writeJSON(w, http.StatusOK, map[string]any{"smartContracts": contracts})
	return nil
}

func (s *Server) getSmartContract(w http.ResponseWriter, r *http.Request, userID uint64, contractID string) error {
	item, err := s.project.GetContract(r.Context(), userID, contractID)
	if errors.Is(err, applicationproject.ErrContractNotFound) {
		return fault.New(fault.NotFound, "智能合约不存在")
	}
	if err != nil {
		return fault.Wrap(fault.Internal, "读取智能合约失败", err)
	}
	contract := smartContractResponse{ID: item.ID, Name: item.Name, Source: item.Source, Version: item.Version, Description: item.Description, Body: item.Body, CreatedAt: item.CreatedAt}
	writeJSON(w, http.StatusOK, contract)
	return nil
}
