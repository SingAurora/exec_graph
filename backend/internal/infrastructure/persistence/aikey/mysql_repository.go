package aikey

import (
	"context"
	"errors"
	"time"

	applicationaikey "github.com/singaurora/exec-graph/backend/internal/application/aikey"
	persistencemysql "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/mysql"
	"gorm.io/gorm"
)

// AIKey 是 AI 服务凭据的数据库模型。KeyCiphertext 只能保存加密后的内容。
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

func (repository AIKeyRepository) Create(ctx context.Context, key *applicationaikey.Record) error {
	model := modelFromRecord(*key)
	if err := repository.db.WithContext(ctx).Create(&model).Error; err != nil {
		return err
	}
	*key = recordFromModel(model)
	return nil
}

func (repository AIKeyRepository) MarkVerified(ctx context.Context, userID uint64, keyID string, verifiedAt time.Time) error {
	return repository.db.WithContext(ctx).Model(&AIKey{}).
		Where("uuid = ? AND user_id = ?", keyID, userID).
		Update("last_verified_at", verifiedAt).Error
}

func (repository AIKeyRepository) DeleteUnusedForUser(ctx context.Context, userID uint64, keyID string) error {
	return repository.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var key AIKey
		if err := tx.Clauses(persistencemysql.ForUpdate).Where("uuid = ? AND user_id = ?", keyID, userID).First(&key).Error; errors.Is(err, gorm.ErrRecordNotFound) {
			return applicationaikey.ErrNotFound
		} else if err != nil {
			return err
		}
		var projectCount int64
		if err := tx.Table("projects").Where("owner_id = ? AND default_ai_key_id = ?", userID, key.ID).Count(&projectCount).Error; err != nil {
			return err
		}
		if projectCount > 0 {
			return applicationaikey.ErrInUse
		}
		return tx.Delete(&key).Error
	})
}

func (repository AIKeyRepository) ListForUser(ctx context.Context, userID uint64) ([]applicationaikey.Record, error) {
	var keys []AIKey
	err := repository.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at ASC").
		Find(&keys).Error
	return recordsFromModels(keys), err
}

func (repository AIKeyRepository) FindForUser(ctx context.Context, userID uint64, keyID string) (applicationaikey.Record, error) {
	var key AIKey
	err := repository.db.WithContext(ctx).
		Where("uuid = ? AND user_id = ?", keyID, userID).
		First(&key).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return applicationaikey.Record{}, applicationaikey.ErrNotFound
	}
	return recordFromModel(key), err
}

func (repository AIKeyRepository) FindProjectReviewKey(ctx context.Context, userID uint64, projectID string) (applicationaikey.Record, error) {
	var key AIKey
	err := repository.db.WithContext(ctx).
		Table("projects AS p").
		Select("k.id, k.uuid, k.user_id, k.provider, k.label, k.key_ciphertext, k.key_hint, k.base_url, k.model, k.last_verified_at, k.last_used_at, k.created_at").
		Joins("JOIN ai_api_keys AS k ON k.id = p.default_ai_key_id").
		Where("p.uuid = ? AND p.owner_id = ?", projectID, userID).
		Scan(&key).Error
	if err != nil {
		return applicationaikey.Record{}, err
	}
	if key.ID == 0 {
		return applicationaikey.Record{}, applicationaikey.ErrNotFound
	}
	return recordFromModel(key), nil
}

func (repository AIKeyRepository) FindLatestProjectReviewKey(ctx context.Context, userID uint64) (applicationaikey.Record, error) {
	var key AIKey
	err := repository.db.WithContext(ctx).
		Table("projects AS p").
		Select("k.id, k.uuid, k.user_id, k.provider, k.label, k.key_ciphertext, k.key_hint, k.base_url, k.model, k.last_verified_at, k.last_used_at, k.created_at").
		Joins("JOIN ai_api_keys AS k ON k.id = p.default_ai_key_id").
		Where("p.owner_id = ? AND p.archived_at IS NULL AND p.default_ai_key_id IS NOT NULL", userID).
		Order("p.updated_at DESC").
		Limit(1).
		Scan(&key).Error
	if err != nil {
		return applicationaikey.Record{}, err
	}
	if key.ID == 0 {
		return applicationaikey.Record{}, applicationaikey.ErrNotFound
	}
	return recordFromModel(key), nil
}

func modelFromRecord(record applicationaikey.Record) AIKey {
	return AIKey{
		ID: record.ID, UUID: record.UUID, UserID: record.UserID, Provider: record.Provider,
		Label: record.Label, KeyCiphertext: record.KeyCiphertext, KeyHint: record.KeyHint,
		BaseURL: record.BaseURL, Model: record.Model, LastVerifiedAt: record.LastVerifiedAt,
		LastUsedAt: record.LastUsedAt, CreatedAt: record.CreatedAt,
	}
}

func recordFromModel(model AIKey) applicationaikey.Record {
	return applicationaikey.Record{
		ID: model.ID, UUID: model.UUID, UserID: model.UserID, Provider: model.Provider,
		Label: model.Label, KeyCiphertext: model.KeyCiphertext, KeyHint: model.KeyHint,
		BaseURL: model.BaseURL, Model: model.Model, LastVerifiedAt: model.LastVerifiedAt,
		LastUsedAt: model.LastUsedAt, CreatedAt: model.CreatedAt,
	}
}

func recordsFromModels(models []AIKey) []applicationaikey.Record {
	records := make([]applicationaikey.Record, 0, len(models))
	for _, model := range models {
		records = append(records, recordFromModel(model))
	}
	return records
}

func (repository AIKeyRepository) MarkUsed(ctx context.Context, userID uint64, keyID string, usedAt time.Time) error {
	return repository.db.WithContext(ctx).Model(&AIKey{}).
		Where("uuid = ? AND user_id = ?", keyID, userID).
		Update("last_used_at", usedAt).Error
}
