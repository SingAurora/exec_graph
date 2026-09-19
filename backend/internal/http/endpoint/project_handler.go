package endpoint

import (
	"errors"
	"net/http"
	"strings"

	applicationproject "github.com/singaurora/exec-graph/backend/internal/application/project"
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

func (s *Server) updateProject(w http.ResponseWriter, r *http.Request, userID uint64, projectID string) {
	var request updateProjectRequest
	if !bindJSON(w, r, &request) {
		return
	}
	title := strings.TrimSpace(request.Title)
	description := strings.TrimSpace(request.Description)
	if title == "" {
		writeError(w, http.StatusBadRequest, "项目名称不能为空")
		return
	}
	if len([]rune(title)) > 160 || len([]rune(description)) > 2000 {
		writeError(w, http.StatusBadRequest, "项目名称或描述过长")
		return
	}
	if request.Visibility != "private" && request.Visibility != "public" {
		writeError(w, http.StatusBadRequest, "项目可见性不正确")
		return
	}
	if err := s.project.Update(r.Context(), userID, projectID, title, description, request.Visibility); err != nil {
		if errors.Is(err, applicationproject.ErrAdoptedContent) {
			writeError(w, http.StatusBadRequest, "项目已有被外部采纳的公开成果，不能改为私人项目")
			return
		}
		if errors.Is(err, applicationproject.ErrNotFound) {
			writeError(w, http.StatusBadRequest, "项目不存在或已归档")
			return
		}
		writeError(w, http.StatusInternalServerError, "保存项目资料失败")
		return
	}
	s.writeProjectState(r.Context(), w, userID, projectID, http.StatusOK)
}

func (s *Server) listProjects(w http.ResponseWriter, r *http.Request, userID uint64) {
	projects, err := s.project.List(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取项目失败")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"projects": projects})
}

func (s *Server) createProject(w http.ResponseWriter, r *http.Request, userID uint64) {
	var request createProjectRequest
	if !bindJSON(w, r, &request) {
		return
	}
	project, err := s.project.Create(r.Context(), applicationproject.CreateInput{
		OwnerID: userID, Title: request.Title, Description: request.Description,
		ProjectType: request.ProjectType, ProjectRules: request.ProjectRules,
		SmartContractID: request.SmartContractID, Visibility: request.Visibility,
		AIKeyID: request.AIKeyID, ContributionCallID: request.ContributionCallID,
	})
	if errors.Is(err, applicationproject.ErrInvalidProject) {
		writeError(w, http.StatusBadRequest, "项目参数不正确，规则引导型项目的规则至少需要 12 个字符")
		return
	}
	if errors.Is(err, applicationproject.ErrAIKeyUnavailable) {
		writeError(w, http.StatusBadRequest, "项目审查 AI 不存在或不可用")
		return
	}
	if errors.Is(err, applicationproject.ErrContractUnavailable) {
		writeError(w, http.StatusBadRequest, "智能合约不存在或不可用")
		return
	}
	if errors.Is(err, applicationproject.ErrCallUnavailable) {
		writeError(w, http.StatusBadRequest, "这个开放缺口当前不能开始新的贡献")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "创建项目失败")
		return
	}
	writeJSON(w, http.StatusCreated, project)
}

func (s *Server) getProject(w http.ResponseWriter, r *http.Request, userID uint64, projectID string) {
	project, err := s.project.Get(r.Context(), userID, projectID)
	if errors.Is(err, applicationproject.ErrNotFound) {
		writeError(w, http.StatusNotFound, "项目不存在")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取项目失败")
		return
	}
	writeJSON(w, http.StatusOK, project)
}

func (s *Server) listSmartContracts(w http.ResponseWriter, r *http.Request, userID uint64) {
	items, err := s.project.ListContracts(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取智能合约失败")
		return
	}
	contracts := make([]smartContractResponse, 0, len(items))
	for _, item := range items {
		contracts = append(contracts, smartContractResponse{ID: item.ID, Name: item.Name, Source: item.Source, Version: item.Version, Description: item.Description, Body: item.Body, CreatedAt: item.CreatedAt})
	}
	writeJSON(w, http.StatusOK, map[string]any{"smartContracts": contracts})
}

func (s *Server) getSmartContract(w http.ResponseWriter, r *http.Request, userID uint64, contractID string) {
	item, err := s.project.GetContract(r.Context(), userID, contractID)
	if errors.Is(err, applicationproject.ErrContractNotFound) {
		writeError(w, http.StatusNotFound, "智能合约不存在")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取智能合约失败")
		return
	}
	contract := smartContractResponse{ID: item.ID, Name: item.Name, Source: item.Source, Version: item.Version, Description: item.Description, Body: item.Body, CreatedAt: item.CreatedAt}
	writeJSON(w, http.StatusOK, contract)
}
