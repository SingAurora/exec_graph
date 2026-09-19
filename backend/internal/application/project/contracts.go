package project

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	infrastructuremysql "github.com/singaurora/exec-graph/backend/internal/infrastructure/mysql"
	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
	sharedid "github.com/singaurora/exec-graph/backend/internal/shared/id"
)

type Contract struct {
	ID, Name, Source, Version, Description, Body string
	CreatedAt                                    time.Time
}
type ContractEvent struct {
	ID, ContractID, EventType string
	Contract                  Contract
	CreatedAt                 time.Time
}

var ErrContractNotFound = errors.New("contract not found")

func (s *Service) ListContracts(ctx context.Context, userID uint64) ([]Contract, error) {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	items, err := infrastructuremysql.NewSmartContractRepository(s.database).ListVisible(ctx, userID)
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
	item, err := infrastructuremysql.NewSmartContractRepository(s.database).FindVisible(ctx, userID, contractID)
	if errors.Is(err, infrastructuremysql.ErrNotFound) {
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
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Contract{}, err
	}
	defer tx.Rollback()
	result, err := tx.ExecContext(ctx, `INSERT INTO smart_contracts (uuid, name, source, version, description, body, created_by) VALUES (?, ?, 'custom', '1.0.0', ?, ?, ?)`, id, name, description, body, userID)
	if err != nil {
		return Contract{}, err
	}
	internalID, err := result.LastInsertId()
	if err != nil {
		return Contract{}, err
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO smart_contract_events (uuid, contract_id, actor_id, event_type, contract_snapshot_json, created_at) VALUES (?, ?, ?, 'created', ?, ?)`, eventID, internalID, userID, snapshot, created); err != nil {
		return Contract{}, err
	}
	if err := tx.Commit(); err != nil {
		return Contract{}, err
	}
	return contract, nil
}

var ErrContractInUse = errors.New("contract is in use")

func (s *Service) DeleteContract(ctx context.Context, userID uint64, contractID string) error {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var internalID uint64
	var contract Contract
	err = tx.QueryRowContext(ctx, `SELECT id, uuid, name, source, version, description, body, created_at FROM smart_contracts WHERE uuid = ? AND created_by = ? AND source = 'custom' AND deleted_at IS NULL FOR UPDATE`, contractID, userID).Scan(&internalID, &contract.ID, &contract.Name, &contract.Source, &contract.Version, &contract.Description, &contract.Body, &contract.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrContractNotFound
	}
	if err != nil {
		return err
	}
	var active int
	if err := tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM projects p JOIN project_contract_revisions r ON r.id = p.active_contract_revision_id WHERE p.owner_id = ? AND r.smart_contract_id = ?`, userID, internalID).Scan(&active); err != nil {
		return err
	}
	if active > 0 {
		return ErrContractInUse
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
	if _, err := tx.ExecContext(ctx, `UPDATE smart_contracts SET deleted_at = ?, deleted_by = ? WHERE uuid = ?`, deleted, userID, contractID); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO smart_contract_events (uuid, contract_id, actor_id, event_type, contract_snapshot_json, created_at) VALUES (?, ?, ?, 'deleted', ?, ?)`, eventID, internalID, userID, snapshot, deleted); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Service) ContractEvents(ctx context.Context, userID uint64) ([]ContractEvent, error) {
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	rows, err := s.db.QueryContext(ctx, `SELECT e.uuid, c.uuid, e.event_type, e.contract_snapshot_json, e.created_at FROM smart_contract_events e JOIN smart_contracts c ON c.id = e.contract_id WHERE e.actor_id = ? ORDER BY e.created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	events := make([]ContractEvent, 0)
	for rows.Next() {
		var event ContractEvent
		var snapshot string
		if err := rows.Scan(&event.ID, &event.ContractID, &event.EventType, &snapshot, &event.CreatedAt); err != nil {
			return nil, err
		}
		if err := json.Unmarshal([]byte(snapshot), &event.Contract); err != nil {
			return nil, err
		}
		events = append(events, event)
	}
	return events, rows.Err()
}
