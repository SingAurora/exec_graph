package project

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	applicationproject "github.com/singaurora/exec-graph/backend/internal/application/project"
	httprequest "github.com/singaurora/exec-graph/backend/internal/http/request"
	httpresponse "github.com/singaurora/exec-graph/backend/internal/http/response"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
)

// Handler 负责项目、项目状态和规则模板的 HTTP 适配。
type Handler struct {
	service *applicationproject.Service
}

func New(service *applicationproject.Service) *Handler {
	return &Handler{service: service}
}

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

type setAIKeyRequest struct {
	AIKeyID string `json:"aiKeyId"`
}

type contractResponse = applicationproject.ContractView

type contractEventResponse struct {
	ID            string           `json:"id"`
	ContractID    string           `json:"contractId"`
	EventType     string           `json:"eventType"`
	SmartContract contractResponse `json:"smartContract"`
	CreatedAt     time.Time        `json:"createdAt"`
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request, userID uint64) error {
	projects, err := h.service.List(r.Context(), userID)
	if err != nil {
		return fault.Wrap(fault.Internal, "读取项目失败", err)
	}
	httpresponse.WriteJSON(w, http.StatusOK, map[string]any{"projects": projects})
	return nil
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request, userID uint64) error {
	var request createProjectRequest
	if err := decodeJSON(r, &request); err != nil {
		return err
	}
	project, err := h.service.Create(r.Context(), applicationproject.CreateInput{
		OwnerID: userID, Title: request.Title, Description: request.Description,
		ProjectType: request.ProjectType, ProjectRules: request.ProjectRules,
		SmartContractID: request.SmartContractID, Visibility: request.Visibility,
		AIKeyID: request.AIKeyID, ContributionCallID: request.ContributionCallID,
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

func (h *Handler) Get(w http.ResponseWriter, r *http.Request, userID uint64, projectID string) error {
	project, err := h.service.Get(r.Context(), userID, projectID)
	if errors.Is(err, applicationproject.ErrNotFound) {
		return fault.New(fault.NotFound, "项目不存在")
	}
	if err != nil {
		return fault.Wrap(fault.Internal, "读取项目失败", err)
	}
	httpresponse.WriteJSON(w, http.StatusOK, project)
	return nil
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request, userID uint64, projectID string) error {
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
	if err := h.service.Update(r.Context(), userID, projectID, title, description, request.Visibility); err != nil {
		if errors.Is(err, applicationproject.ErrAdoptedContent) {
			return fault.New(fault.Conflict, "项目已有被外部采纳的公开成果，不能改为私人项目")
		}
		if errors.Is(err, applicationproject.ErrNotFound) {
			return fault.New(fault.NotFound, "项目不存在或已归档")
		}
		return fault.Wrap(fault.Internal, "保存项目资料失败", err)
	}
	return h.writeState(r.Context(), w, userID, projectID, http.StatusOK)
}

func (h *Handler) SetAIKey(w http.ResponseWriter, r *http.Request, userID uint64, projectID string) error {
	var request setAIKeyRequest
	if err := decodeJSON(r, &request); err != nil {
		return err
	}
	keyID := strings.TrimSpace(request.AIKeyID)
	if keyID == "" {
		return fault.New(fault.InvalidRequest, "请选择项目审查 AI")
	}
	if err := h.service.SetAIKey(r.Context(), userID, projectID, keyID); err != nil {
		return fault.New(fault.InvalidRequest, "AI 密钥不可用，或项目已归档")
	}
	project, err := h.service.Get(r.Context(), userID, projectID)
	if err != nil {
		return fault.Wrap(fault.Internal, "读取项目失败", err)
	}
	httpresponse.WriteJSON(w, http.StatusOK, project)
	return nil
}

func (h *Handler) SetContract(w http.ResponseWriter, r *http.Request, userID uint64, projectID string) error {
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
	project, err := h.service.SetContract(r.Context(), userID, projectID, contractID)
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

func (h *Handler) Archive(w http.ResponseWriter, r *http.Request, userID uint64, projectID string) error {
	if err := h.service.Archive(r.Context(), userID, projectID); err != nil {
		if errors.Is(err, applicationproject.ErrAlreadyArchived) {
			return fault.New(fault.InvalidRequest, "项目不存在或已经归档")
		}
		return fault.Wrap(fault.Internal, "归档项目失败", err)
	}
	httpresponse.WriteJSON(w, http.StatusOK, map[string]string{"message": "项目已归档"})
	return nil
}

func (h *Handler) Unarchive(w http.ResponseWriter, r *http.Request, userID uint64, projectID string) error {
	if err := h.service.Unarchive(r.Context(), userID, projectID); err != nil {
		if errors.Is(err, applicationproject.ErrNotArchived) {
			return fault.New(fault.InvalidRequest, "项目不存在或未归档")
		}
		return fault.Wrap(fault.Internal, "恢复项目失败", err)
	}
	httpresponse.WriteJSON(w, http.StatusOK, map[string]string{"message": "项目已恢复"})
	return nil
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request, userID uint64, projectID string) error {
	err := h.service.Delete(r.Context(), userID, projectID)
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

func (h *Handler) Graph(w http.ResponseWriter, r *http.Request, userID uint64, projectID string) error {
	return h.writeState(r.Context(), w, userID, projectID, http.StatusOK)
}

func (h *Handler) ListContracts(w http.ResponseWriter, r *http.Request, userID uint64) error {
	items, err := h.service.ListContracts(r.Context(), userID)
	if err != nil {
		return fault.Wrap(fault.Internal, "读取智能合约失败", err)
	}
	contracts := make([]contractResponse, 0, len(items))
	for _, item := range items {
		contracts = append(contracts, contractResponse{ID: item.ID, Name: item.Name, Source: item.Source, Version: item.Version, Description: item.Description, Body: item.Body, CreatedAt: item.CreatedAt})
	}
	httpresponse.WriteJSON(w, http.StatusOK, map[string]any{"smartContracts": contracts})
	return nil
}

func (h *Handler) GetContract(w http.ResponseWriter, r *http.Request, userID uint64, contractID string) error {
	item, err := h.service.GetContract(r.Context(), userID, contractID)
	if errors.Is(err, applicationproject.ErrContractNotFound) {
		return fault.New(fault.NotFound, "智能合约不存在")
	}
	if err != nil {
		return fault.Wrap(fault.Internal, "读取智能合约失败", err)
	}
	contract := contractResponse{ID: item.ID, Name: item.Name, Source: item.Source, Version: item.Version, Description: item.Description, Body: item.Body, CreatedAt: item.CreatedAt}
	httpresponse.WriteJSON(w, http.StatusOK, contract)
	return nil
}

func (h *Handler) CreateContract(w http.ResponseWriter, r *http.Request, userID uint64) error {
	var input struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		Body        string `json:"body"`
	}
	if err := decodeJSON(r, &input); err != nil {
		return err
	}
	name, description, body := strings.TrimSpace(input.Name), strings.TrimSpace(input.Description), strings.TrimSpace(input.Body)
	if len([]rune(name)) < 2 || body == "" {
		return fault.New(fault.InvalidRequest, "请填写合约名称和 Markdown 正文")
	}
	contract, err := h.service.CreateContract(r.Context(), userID, name, description, body)
	if err != nil {
		return fault.Wrap(fault.Internal, "创建智能合约失败", err)
	}
	httpresponse.WriteJSON(w, http.StatusCreated, contractResponse{ID: contract.ID, Name: contract.Name, Source: contract.Source, Version: contract.Version, Description: contract.Description, Body: contract.Body, CreatedAt: contract.CreatedAt})
	return nil
}

func (h *Handler) DeleteContract(w http.ResponseWriter, r *http.Request, userID uint64, contractID string) error {
	err := h.service.DeleteContract(r.Context(), userID, contractID)
	switch {
	case errors.Is(err, applicationproject.ErrContractNotFound):
		return fault.New(fault.NotFound, "自定义智能合约不存在或已经删除")
	case errors.Is(err, applicationproject.ErrContractInUse):
		return fault.New(fault.Conflict, "该合约正在被项目使用，请先修改项目智能合约")
	case err != nil:
		return fault.Wrap(fault.Internal, "删除智能合约失败", err)
	default:
		httpresponse.WriteJSON(w, http.StatusOK, nil)
		return nil
	}
}

func (h *Handler) ContractHistory(w http.ResponseWriter, r *http.Request, userID uint64) error {
	events, err := h.service.ContractEvents(r.Context(), userID)
	if err != nil {
		return fault.Wrap(fault.Internal, "读取智能合约记录失败", err)
	}
	result := make([]contractEventResponse, 0, len(events))
	for _, event := range events {
		result = append(result, contractEventResponse{ID: event.ID, ContractID: event.ContractID, EventType: event.EventType, SmartContract: contractResponse{ID: event.Contract.ID, Name: event.Contract.Name, Source: event.Contract.Source, Version: event.Contract.Version, Description: event.Contract.Description, Body: event.Contract.Body, CreatedAt: event.Contract.CreatedAt}, CreatedAt: event.CreatedAt})
	}
	httpresponse.WriteJSON(w, http.StatusOK, map[string]any{"events": result})
	return nil
}

func (h *Handler) writeState(ctx context.Context, w http.ResponseWriter, userID uint64, projectID string, status int) error {
	state, err := h.service.State(ctx, userID, projectID)
	if errors.Is(err, applicationproject.ErrNotFound) {
		return fault.New(fault.NotFound, "项目不存在")
	}
	if err != nil {
		return fault.Wrap(fault.Internal, "读取项目状态失败", err)
	}
	httpresponse.WriteJSON(w, status, state)
	return nil
}

func decodeJSON(r *http.Request, target any) error {
	if err := httprequest.DecodeJSON(r, target); err != nil {
		return fault.New(fault.InvalidRequest, "请求格式不正确")
	}
	return nil
}
