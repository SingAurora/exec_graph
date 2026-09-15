package mysql

import (
	"context"
	"errors"
	"time"

	"gorm.io/gorm"
)

var (
	ErrNotFound = errors.New("record not found")
	ErrInUse    = errors.New("record is in use")
)

type SmartContract struct {
	ID          string    `gorm:"column:id"`
	Name        string    `gorm:"column:name"`
	Source      string    `gorm:"column:source"`
	Version     string    `gorm:"column:version"`
	Description string    `gorm:"column:description"`
	Body        string    `gorm:"column:body"`
	CreatedAt   time.Time `gorm:"column:created_at"`
}

func (SmartContract) TableName() string { return "smart_contracts" }

type SmartContractRepository struct {
	db *gorm.DB
}

func NewSmartContractRepository(db *gorm.DB) SmartContractRepository {
	return SmartContractRepository{db: db}
}

func (repository SmartContractRepository) FindByID(ctx context.Context, contractID string) (SmartContract, error) {
	var contract SmartContract
	err := repository.db.WithContext(ctx).First(&contract, "id = ?", contractID).Error
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
		Where("id = ? AND deleted_at IS NULL AND (source = ? OR created_by = ?)", contractID, "official", userID).
		First(&contract).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return SmartContract{}, ErrNotFound
	}
	return contract, err
}
