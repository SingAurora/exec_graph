package project

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	contractpersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/contract"
	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
	sharedid "github.com/singaurora/exec-graph/backend/internal/shared/id"
)

func (s *Service) ListContracts(ctx context.Context, userID uint64) ([]Contract, error) {
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

func (s *Service) GetContract(ctx context.Context, userID uint64, contractID string) (Contract, error) {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	item, err := s.contracts.FindVisible(ctx, userID, contractID)
	if errors.Is(err, contractpersistence.ErrNotFound) {
		return Contract{}, ErrContractNotFound
	}
	if err != nil {
		return Contract{}, err
	}
	return Contract{ID: item.UUID, Name: item.Name, Source: item.Source, Version: item.Version, Description: item.Description, Body: item.Body, CreatedAt: item.CreatedAt}, nil
}

func (s *Service) CreateContract(ctx context.Context, userID uint64, name, description, body string) (Contract, error) {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	id, err := sharedid.Opaque("smart-contract")
	if err != nil {
		return Contract{}, err
	}
	eventID, err := sharedid.Opaque("contract-event")
	if err != nil {
		return Contract{}, err
	}
	created := time.Now()
	contract := Contract{ID: id, Name: name, Source: "custom", Version: "1.0.0", Description: description, Body: body, CreatedAt: created}
	snapshot, err := json.Marshal(contract)
	if err != nil {
		return Contract{}, err
	}
	if err := s.contracts.CreateCustom(ctx, contractpersistence.CreateCustomInput{ID: id, EventID: eventID, Name: name, Description: description, Body: body, Snapshot: string(snapshot), OwnerID: userID, CreatedAt: created}); err != nil {
		return Contract{}, err
	}
	return contract, nil
}

func (s *Service) DeleteContract(ctx context.Context, userID uint64, contractID string) error {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	contract, err := s.contracts.FindVisible(ctx, userID, contractID)
	if errors.Is(err, contractpersistence.ErrNotFound) {
		return ErrContractNotFound
	}
	if err != nil {
		return err
	}
	snapshot, err := json.Marshal(contract)
	if err != nil {
		return err
	}
	eventID, err := sharedid.Opaque("contract-event")
	if err != nil {
		return err
	}
	deleted := time.Now()
	if err := s.contracts.DeleteCustom(ctx, userID, contractID, eventID, string(snapshot), deleted); errors.Is(err, contractpersistence.ErrNotFound) {
		return ErrContractNotFound
	} else if errors.Is(err, contractpersistence.ErrInUse) {
		return ErrContractInUse
	} else {
		return err
	}
}

func (s *Service) ContractEvents(ctx context.Context, userID uint64) ([]ContractEvent, error) {
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
		if err := contractpersistence.DecodeEventContract(row.SnapshotJSON, &event.Contract); err != nil {
			return nil, err
		}
		events = append(events, event)
	}
	return events, nil
}
