package contract

import (
	"context"
	"errors"
	"time"

	applicationproject "github.com/singaurora/exec-graph/backend/internal/application/project"
)

// ApplicationRepository adapts smart-contract persistence to the project application port.
type ApplicationRepository struct{ repository SmartContractRepository }

func NewApplicationRepository(repository SmartContractRepository) ApplicationRepository {
	return ApplicationRepository{repository: repository}
}

func (adapter ApplicationRepository) CreateCustom(ctx context.Context, input applicationproject.CreateContractRecord) error {
	return adapter.repository.CreateCustom(ctx, CreateCustomInput{ID: input.ID, EventID: input.EventID, Name: input.Name, Description: input.Description, Body: input.Body, Snapshot: input.Snapshot, OwnerID: input.OwnerID, CreatedAt: input.CreatedAt})
}

func (adapter ApplicationRepository) DeleteCustom(ctx context.Context, userID uint64, contractUUID, eventUUID, snapshot string, deletedAt time.Time) error {
	return mapProjectApplicationError(adapter.repository.DeleteCustom(ctx, userID, contractUUID, eventUUID, snapshot, deletedAt))
}

func (adapter ApplicationRepository) ListEvents(ctx context.Context, userID uint64) ([]applicationproject.ContractEventRecord, error) {
	values, err := adapter.repository.ListEvents(ctx, userID)
	if err != nil {
		return nil, err
	}
	result := make([]applicationproject.ContractEventRecord, 0, len(values))
	for _, value := range values {
		result = append(result, applicationproject.ContractEventRecord{ID: value.ID, ContractID: value.ContractID, EventType: value.EventType, SnapshotJSON: value.SnapshotJSON, CreatedAt: value.CreatedAt})
	}
	return result, nil
}

func (adapter ApplicationRepository) ListVisible(ctx context.Context, userID uint64) ([]applicationproject.ContractRecord, error) {
	values, err := adapter.repository.ListVisible(ctx, userID)
	if err != nil {
		return nil, err
	}
	result := make([]applicationproject.ContractRecord, 0, len(values))
	for _, value := range values {
		result = append(result, contractRecord(value))
	}
	return result, nil
}

func (adapter ApplicationRepository) FindVisible(ctx context.Context, userID uint64, contractUUID string) (applicationproject.ContractRecord, error) {
	value, err := adapter.repository.FindVisible(ctx, userID, contractUUID)
	if err != nil {
		return applicationproject.ContractRecord{}, mapProjectApplicationError(err)
	}
	return contractRecord(value), nil
}

func contractRecord(value SmartContract) applicationproject.ContractRecord {
	return applicationproject.ContractRecord{ID: value.ID, UUID: value.UUID, Name: value.Name, Source: value.Source, Version: value.Version, Description: value.Description, Body: value.Body, CreatedBy: value.CreatedBy, DeletedAt: value.DeletedAt, CreatedAt: value.CreatedAt}
}

func mapProjectApplicationError(err error) error {
	switch {
	case errors.Is(err, ErrNotFound):
		return applicationproject.ErrContractRecordNotFound
	case errors.Is(err, ErrInUse):
		return applicationproject.ErrContractRecordInUse
	default:
		return err
	}
}
