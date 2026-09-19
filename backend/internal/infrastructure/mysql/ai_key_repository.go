package mysql

import (
	"context"
	"errors"
	"time"

	"gorm.io/gorm"
)

// AIKey is the internal representation of an AI provider credential. Its
// ciphertext must never be serialized into an API response.
type AIKey struct {
	ID             uint64     `gorm:"column:id;primaryKey"`
	UUID           string     `gorm:"column:uuid"`
	UserID         uint64     `gorm:"column:user_id"`
	Provider       string     `gorm:"column:provider"`
	Label          string     `gorm:"column:label"`
	KeyCiphertext  string     `gorm:"column:key_ciphertext"`
	KeyHint        string     `gorm:"column:key_hint"`
	BaseURL        string     `gorm:"column:base_url"`
	Model          string     `gorm:"column:model"`
	LastVerifiedAt *time.Time `gorm:"column:last_verified_at"`
	LastUsedAt     *time.Time `gorm:"column:last_used_at"`
	CreatedAt      time.Time  `gorm:"column:created_at"`
}

func (AIKey) TableName() string { return "ai_api_keys" }

type AIKeyRepository struct {
	db *gorm.DB
}

func NewAIKeyRepository(db *gorm.DB) AIKeyRepository {
	return AIKeyRepository{db: db}
}

func (repository AIKeyRepository) Create(ctx context.Context, key *AIKey) error {
	return repository.db.WithContext(ctx).Create(key).Error
}

func (repository AIKeyRepository) MarkVerified(ctx context.Context, userID uint64, keyID string, verifiedAt time.Time) error {
	return repository.db.WithContext(ctx).Model(&AIKey{}).
		Where("uuid = ? AND user_id = ?", keyID, userID).
		Update("last_verified_at", verifiedAt).Error
}

func (repository AIKeyRepository) DeleteUnusedForUser(ctx context.Context, userID uint64, keyID string) error {
	return repository.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var key AIKey
		if err := tx.Clauses(clauseForUpdate).Where("uuid = ? AND user_id = ?", keyID, userID).First(&key).Error; errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrNotFound
		} else if err != nil {
			return err
		}
		var projectCount int64
		if err := tx.Model(&Project{}).Where("owner_id = ? AND default_ai_key_id = ?", userID, key.ID).Count(&projectCount).Error; err != nil {
			return err
		}
		if projectCount > 0 {
			return ErrInUse
		}
		return tx.Delete(&key).Error
	})
}

func (repository AIKeyRepository) ListForUser(ctx context.Context, userID uint64) ([]AIKey, error) {
	var keys []AIKey
	err := repository.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at ASC").
		Find(&keys).Error
	return keys, err
}

func (repository AIKeyRepository) FindForUser(ctx context.Context, userID uint64, keyID string) (AIKey, error) {
	var key AIKey
	err := repository.db.WithContext(ctx).
		Where("uuid = ? AND user_id = ?", keyID, userID).
		First(&key).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return AIKey{}, ErrNotFound
	}
	return key, err
}

func (repository AIKeyRepository) FindProjectReviewKey(ctx context.Context, userID uint64, projectID string) (AIKey, error) {
	var key AIKey
	err := repository.db.WithContext(ctx).
		Table("projects AS p").
		Select("k.id, k.uuid, k.user_id, k.provider, k.label, k.key_ciphertext, k.key_hint, k.base_url, k.model, k.last_verified_at, k.last_used_at, k.created_at").
		Joins("JOIN ai_api_keys AS k ON k.id = p.default_ai_key_id").
		Where("p.uuid = ? AND p.owner_id = ?", projectID, userID).
		Scan(&key).Error
	if err != nil {
		return AIKey{}, err
	}
	if key.ID == 0 {
		return AIKey{}, ErrNotFound
	}
	return key, nil
}
