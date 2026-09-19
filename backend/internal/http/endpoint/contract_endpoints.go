package endpoint

import (
	"errors"
	"net/http"
	"strings"
	"time"

	applicationproject "github.com/singaurora/exec-graph/backend/internal/application/project"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
)

type smartContractResponse = applicationproject.ContractView

type smartContractEventResponse struct {
	ID            string                `json:"id"`
	ContractID    string                `json:"contractId"`
	EventType     string                `json:"eventType"`
	SmartContract smartContractResponse `json:"smartContract"`
	CreatedAt     time.Time             `json:"createdAt"`
}

func (s *Server) createSmartContractApplication(w http.ResponseWriter, r *http.Request, userID uint64) error {
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
	contract, err := s.project.CreateContract(r.Context(), userID, name, description, body)
	if err != nil {
		return fault.Wrap(fault.Internal, "创建智能合约失败", err)
	}
	writeJSON(w, http.StatusCreated, smartContractResponse{ID: contract.ID, Name: contract.Name, Source: contract.Source, Version: contract.Version, Description: contract.Description, Body: contract.Body, CreatedAt: contract.CreatedAt})
	return nil
}

func (s *Server) deleteSmartContractApplication(w http.ResponseWriter, r *http.Request, userID uint64, contractID string) error {
	err := s.project.DeleteContract(r.Context(), userID, contractID)
	switch {
	case errors.Is(err, applicationproject.ErrContractNotFound):
		return fault.New(fault.NotFound, "自定义智能合约不存在或已经删除")
	case errors.Is(err, applicationproject.ErrContractInUse):
		return fault.New(fault.Conflict, "该合约正在被项目使用，请先修改项目智能合约")
	case err != nil:
		return fault.Wrap(fault.Internal, "删除智能合约失败", err)
	default:
		writeJSON(w, http.StatusOK, nil)
		return nil
	}
}

func (s *Server) listSmartContractEventsApplication(w http.ResponseWriter, r *http.Request, userID uint64) error {
	events, err := s.project.ContractEvents(r.Context(), userID)
	if err != nil {
		return fault.Wrap(fault.Internal, "读取智能合约记录失败", err)
	}
	result := make([]smartContractEventResponse, 0, len(events))
	for _, event := range events {
		result = append(result, smartContractEventResponse{ID: event.ID, ContractID: event.ContractID, EventType: event.EventType, SmartContract: smartContractResponse{ID: event.Contract.ID, Name: event.Contract.Name, Source: event.Contract.Source, Version: event.Contract.Version, Description: event.Contract.Description, Body: event.Contract.Body, CreatedAt: event.Contract.CreatedAt}, CreatedAt: event.CreatedAt})
	}
	writeJSON(w, http.StatusOK, map[string]any{"events": result})
	return nil
}
