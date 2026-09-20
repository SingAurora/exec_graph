package contract

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"gorm.io/gorm"
)

var (
	ErrNotFound = errors.New("record not found")
	ErrInUse    = errors.New("record is in use")
)

type SmartContract struct {
	ID          uint64     `gorm:"column:id;primaryKey"`
	UUID        string     `gorm:"column:uuid"`
	Name        string     `gorm:"column:name"`
	Source      string     `gorm:"column:source"`
	Version     string     `gorm:"column:version"`
	Description string     `gorm:"column:description"`
	Body        string     `gorm:"column:body"`
	CreatedBy   uint64     `gorm:"column:created_by"`
	DeletedAt   *time.Time `gorm:"column:deleted_at"`
	CreatedAt   time.Time  `gorm:"column:created_at"`
}

func (SmartContract) TableName() string { return "smart_contracts" }

type SmartContractRepository struct {
	db *gorm.DB
}

// ContractEvent records a user-visible contract lifecycle change.
type ContractEvent struct {
	ID           string    `gorm:"column:uuid"`
	ContractID   string    `gorm:"column:contract_uuid"`
	EventType    string    `gorm:"column:event_type"`
	SnapshotJSON string    `gorm:"column:contract_snapshot_json"`
	CreatedAt    time.Time `gorm:"column:created_at"`
}

// CreateCustomInput contains the data needed to create a custom contract.
type CreateCustomInput struct {
	ID, EventID, Name, Description, Body, Snapshot string
	OwnerID                                        uint64
	CreatedAt                                      time.Time
}

// CreateCustom creates a custom contract and its audit event atomically.
func (repository SmartContractRepository) CreateCustom(ctx context.Context, input CreateCustomInput) error {
	return repository.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		contract := SmartContract{UUID: input.ID, Name: input.Name, Source: "custom", Version: "1.0.0", Description: input.Description, Body: input.Body, CreatedBy: input.OwnerID, CreatedAt: input.CreatedAt}
		if err := tx.Create(&contract).Error; err != nil {
			return err
		}
		return tx.Table("smart_contract_events").Create(map[string]any{"uuid": input.EventID, "contract_id": contract.ID, "actor_id": input.OwnerID, "event_type": "created", "contract_snapshot_json": input.Snapshot, "created_at": input.CreatedAt}).Error
	})
}

// DeleteCustom marks a custom contract deleted when it is not in use.
func (repository SmartContractRepository) DeleteCustom(ctx context.Context, userID uint64, contractID, eventID, snapshot string, deletedAt time.Time) error {
	return repository.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var contract SmartContract
		if err := tx.Where("uuid = ? AND created_by = ? AND source = ? AND deleted_at IS NULL", contractID, userID, "custom").First(&contract).Error; errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrNotFound
		} else if err != nil {
			return err
		}
		var count int64
		if err := tx.Table("projects AS p").Joins("JOIN project_contract_revisions AS r ON r.id = p.active_contract_revision_id").Where("p.owner_id = ? AND r.smart_contract_id = ?", userID, contract.ID).Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			return ErrInUse
		}
		if err := tx.Model(&contract).Updates(map[string]any{"deleted_at": deletedAt, "deleted_by": userID}).Error; err != nil {
			return err
		}
		return tx.Table("smart_contract_events").Create(map[string]any{"uuid": eventID, "contract_id": contract.ID, "actor_id": userID, "event_type": "deleted", "contract_snapshot_json": snapshot, "created_at": deletedAt}).Error
	})
}

// ListEvents returns the contract history for a user.
func (repository SmartContractRepository) ListEvents(ctx context.Context, userID uint64) ([]ContractEvent, error) {
	var events []ContractEvent
	err := repository.db.WithContext(ctx).Table("smart_contract_events AS e").Select("e.uuid, c.uuid AS contract_uuid, e.event_type, e.contract_snapshot_json, e.created_at").Joins("JOIN smart_contracts AS c ON c.id = e.contract_id").Where("e.actor_id = ?", userID).Order("e.created_at DESC").Scan(&events).Error
	return events, err
}

// DecodeEventContract decodes the immutable event snapshot.
func DecodeEventContract(snapshot string, target any) error {
	return json.Unmarshal([]byte(snapshot), target)
}

func NewSmartContractRepository(db *gorm.DB) SmartContractRepository {
	return SmartContractRepository{db: db}
}

func (repository SmartContractRepository) FindByID(ctx context.Context, contractID string) (SmartContract, error) {
	var contract SmartContract
	err := repository.db.WithContext(ctx).First(&contract, "uuid = ?", contractID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return SmartContract{}, ErrNotFound
	}
	return contract, err
}

func (repository SmartContractRepository) ListVisible(ctx context.Context, userID uint64) ([]SmartContract, error) {
	var contracts []SmartContract
	err := repository.db.WithContext(ctx).
		Where("deleted_at IS NULL AND (source = ? OR created_by = ?)", "official", userID).
		Order("source ASC, created_at ASC").
		Find(&contracts).Error
	return contracts, err
}

func (repository SmartContractRepository) FindVisible(ctx context.Context, userID uint64, contractID string) (SmartContract, error) {
	var contract SmartContract
	err := repository.db.WithContext(ctx).
		Where("uuid = ? AND deleted_at IS NULL AND (source = ? OR created_by = ?)", contractID, "official", userID).
		First(&contract).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return SmartContract{}, ErrNotFound
	}
	return contract, err
}
