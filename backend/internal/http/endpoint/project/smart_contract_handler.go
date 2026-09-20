package project

import (
	"errors"
	"net/http"
	"strings"

	applicationproject "github.com/singaurora/exec-graph/backend/internal/application/project"
	httpresponse "github.com/singaurora/exec-graph/backend/internal/http/response"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
)

// ListAvailableSmartContracts 返回系统合约和当前用户创建的合约。
func (h *Handler) ListAvailableSmartContracts(w http.ResponseWriter, r *http.Request, userID uint64) error {
	items, err := h.service.ListAvailableSmartContracts(r.Context(), userID)
	if err != nil {
		return fault.Wrap(fault.Internal, "读取智能合约失败", err)
	}
	contracts := make([]contractResponse, 0, len(items))
	for _, item := range items {
		contracts = append(contracts, toContractResponse(item))
	}
	httpresponse.WriteJSON(w, http.StatusOK, map[string]any{"smartContracts": contracts})
	return nil
}

// GetSmartContractDetail 返回一份可访问智能合约的完整内容。
func (h *Handler) GetSmartContractDetail(w http.ResponseWriter, r *http.Request, userID uint64) error {
	contractUUID := strings.TrimSpace(r.URL.Query().Get("contractUuid"))
	if contractUUID == "" {
		return fault.New(fault.InvalidRequest, "缺少智能合约 UUID")
	}
	contract, err := h.service.GetSmartContract(r.Context(), userID, contractUUID)
	if errors.Is(err, applicationproject.ErrContractNotFound) {
		return fault.New(fault.NotFound, "智能合约不存在")
	}
	if err != nil {
		return fault.Wrap(fault.Internal, "读取智能合约失败", err)
	}
	httpresponse.WriteJSON(w, http.StatusOK, toContractResponse(contract))
	return nil
}

// CreateSmartContract 创建用户自定义智能合约。
func (h *Handler) CreateSmartContract(w http.ResponseWriter, r *http.Request, userID uint64) error {
	var request createSmartContractRequest
	if err := decodeJSON(r, &request); err != nil {
		return err
	}
	name := strings.TrimSpace(request.Name)
	description := strings.TrimSpace(request.Description)
	body := strings.TrimSpace(request.Body)
	if len([]rune(name)) < 2 || body == "" {
		return fault.New(fault.InvalidRequest, "请填写合约名称和 Markdown 正文")
	}
	contract, err := h.service.CreateSmartContract(r.Context(), userID, name, description, body)
	if err != nil {
		return fault.Wrap(fault.Internal, "创建智能合约失败", err)
	}
	httpresponse.WriteJSON(w, http.StatusCreated, toContractResponse(contract))
	return nil
}

// DeleteSmartContract 删除一份未被项目使用的用户自定义合约。
func (h *Handler) DeleteSmartContract(w http.ResponseWriter, r *http.Request, userID uint64) error {
	var request deleteSmartContractRequest
	if err := decodeJSON(r, &request); err != nil {
		return err
	}
	contractUUID := strings.TrimSpace(request.ContractUUID)
	if contractUUID == "" {
		return fault.New(fault.InvalidRequest, "缺少智能合约 UUID")
	}
	err := h.service.DeleteSmartContract(r.Context(), userID, contractUUID)
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

// ListSmartContractHistory 返回智能合约相关的历史事件。
func (h *Handler) ListSmartContractHistory(w http.ResponseWriter, r *http.Request, userID uint64) error {
	events, err := h.service.ListSmartContractEvents(r.Context(), userID)
	if err != nil {
		return fault.Wrap(fault.Internal, "读取智能合约记录失败", err)
	}
	result := make([]contractEventResponse, 0, len(events))
	for _, event := range events {
		result = append(result, contractEventResponse{
			ID: event.ID, ContractID: event.ContractID, EventType: event.EventType,
			SmartContract: toContractResponse(event.Contract), CreatedAt: event.CreatedAt,
		})
	}
	httpresponse.WriteJSON(w, http.StatusOK, map[string]any{"events": result})
	return nil
}
