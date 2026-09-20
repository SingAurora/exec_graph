package project

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
	sharedid "github.com/singaurora/exec-graph/backend/internal/shared/id"
)

// ListAvailableSmartContracts 列出系统合约和当前用户创建的合约。
func (s *Service) ListAvailableSmartContracts(ctx context.Context, userID uint64) ([]Contract, error) {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	items, err := s.contracts.ListVisible(ctx, userID)
	if err != nil {
		return nil, err
	}
	result := make([]Contract, 0, len(items))
	for _, item := range items {
		result = append(result, Contract{ID: item.UUID, Name: item.Name, Source: item.Source, Version: item.Version, Description: item.Description, Body: item.Body, CreatedAt: item.CreatedAt})
	}
	return result, nil
}

// GetSmartContract 返回当前用户可访问的一份智能合约。
func (s *Service) GetSmartContract(ctx context.Context, userID uint64, contractID string) (Contract, error) {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	item, err := s.contracts.FindVisible(ctx, userID, contractID)
	if errors.Is(err, ErrContractRecordNotFound) {
		return Contract{}, ErrContractNotFound
	}
	if err != nil {
		return Contract{}, err
	}
	return Contract{ID: item.UUID, Name: item.Name, Source: item.Source, Version: item.Version, Description: item.Description, Body: item.Body, CreatedAt: item.CreatedAt}, nil
}

// CreateSmartContract 创建一份用户自定义智能合约。
func (s *Service) CreateSmartContract(ctx context.Context, userID uint64, name, description, body string) (Contract, error) {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	id, err := sharedid.UUID()
	if err != nil {
		return Contract{}, err
	}
	eventID, err := sharedid.UUID()
	if err != nil {
		return Contract{}, err
	}
	created := time.Now()
	contract := Contract{ID: id, Name: name, Source: "custom", Version: "1.0.0", Description: description, Body: body, CreatedAt: created}
	snapshot, err := json.Marshal(contract)
	if err != nil {
		return Contract{}, err
	}
	if err := s.contracts.CreateCustom(ctx, CreateContractRecord{ID: id, EventID: eventID, Name: name, Description: description, Body: body, Snapshot: string(snapshot), OwnerID: userID, CreatedAt: created}); err != nil {
		return Contract{}, err
	}
	return contract, nil
}

// DeleteSmartContract 删除一份未被项目使用的用户自定义智能合约。
func (s *Service) DeleteSmartContract(ctx context.Context, userID uint64, contractID string) error {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	contract, err := s.contracts.FindVisible(ctx, userID, contractID)
	if errors.Is(err, ErrContractRecordNotFound) {
		return ErrContractNotFound
	}
	if err != nil {
		return err
	}
	snapshot, err := json.Marshal(contract)
	if err != nil {
		return err
	}
	eventID, err := sharedid.UUID()
	if err != nil {
		return err
	}
	deleted := time.Now()
	if err := s.contracts.DeleteCustom(ctx, userID, contractID, eventID, string(snapshot), deleted); errors.Is(err, ErrContractRecordNotFound) {
		return ErrContractNotFound
	} else if errors.Is(err, ErrContractRecordInUse) {
		return ErrContractInUse
	} else {
		return err
	}
}

// ListSmartContractEvents 返回智能合约的创建、删除和使用记录。
func (s *Service) ListSmartContractEvents(ctx context.Context, userID uint64) ([]ContractEvent, error) {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	rows, err := s.contracts.ListEvents(ctx, userID)
	if err != nil {
		return nil, err
	}
	events := make([]ContractEvent, 0)
	for _, row := range rows {
		var event ContractEvent
		event.ID, event.ContractID, event.EventType, event.CreatedAt = row.ID, row.ContractID, row.EventType, row.CreatedAt
		if err := json.Unmarshal([]byte(row.SnapshotJSON), &event.Contract); err != nil {
			return nil, err
		}
		events = append(events, event)
	}
	return events, nil
}
