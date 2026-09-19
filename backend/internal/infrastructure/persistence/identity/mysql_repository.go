package identity

import (
	"context"
	"errors"
	"time"

	persistencemysql "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/mysql"
	projectpersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/project"
	"gorm.io/gorm"
)

var ErrNotFound = errors.New("identity record not found")

// User is the persistence model for an account. API response shapes remain in
// the application layer so credential and storage fields cannot leak by
// accident.
type User struct {
	ID                    uint64     `gorm:"column:id;primaryKey"`
	Username              string     `gorm:"column:username"`
	UserID                string     `gorm:"column:user_id"`
	IsTestAccount         bool       `gorm:"column:is_test_account"`
	Email                 string     `gorm:"column:email"`
	PasswordHash          string     `gorm:"column:password_hash"`
	EmailVerifiedAt       *time.Time `gorm:"column:email_verified_at"`
	Bio                   *string    `gorm:"column:bio"`
	Gender                *string    `gorm:"column:gender"`
	AvatarURL             *string    `gorm:"column:avatar_url"`
	ProfileBackgroundURL  *string    `gorm:"column:profile_background_url"`
	CustomProfileEnabled  bool       `gorm:"column:custom_profile_enabled"`
	CustomProfileMarkdown *string    `gorm:"column:custom_profile_markdown"`
	CreatedAt             time.Time  `gorm:"column:created_at"`
	UpdatedAt             time.Time  `gorm:"column:updated_at"`
}

func (User) TableName() string { return "users" }

type EmailVerificationCode struct {
	ID        uint64     `gorm:"column:id;primaryKey"`
	Email     string     `gorm:"column:email"`
	Purpose   string     `gorm:"column:purpose"`
	CodeHash  string     `gorm:"column:code_hash"`
	ExpiresAt time.Time  `gorm:"column:expires_at"`
	UsedAt    *time.Time `gorm:"column:used_at"`
	SendIP    *string    `gorm:"column:send_ip"`
	CreatedAt time.Time  `gorm:"column:created_at"`
}

func (EmailVerificationCode) TableName() string { return "email_verification_codes" }

type IdentityRepository struct {
	db *gorm.DB
}

func NewIdentityRepository(db *gorm.DB) IdentityRepository {
	return IdentityRepository{db: db}
}

func (repository IdentityRepository) ProjectRepository() projectpersistence.ProjectRepository {
	return projectpersistence.NewProjectRepository(repository.db)
}

func (repository IdentityRepository) Transaction(ctx context.Context, fn func(tx IdentityRepository) error) error {
	return repository.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		return fn(IdentityRepository{db: tx})
	})
}

func (repository IdentityRepository) FindUserByEmail(ctx context.Context, email string, lock bool) (User, error) {
	var user User
	query := repository.db.WithContext(ctx).Where("email = ?", email)
	if lock {
		query = query.Clauses(persistencemysql.ForUpdate)
	}
	err := query.First(&user).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return User{}, ErrNotFound
	}
	return user, err
}

func (repository IdentityRepository) FindUserByID(ctx context.Context, userID uint64) (User, error) {
	var user User
	err := repository.db.WithContext(ctx).First(&user, userID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return User{}, ErrNotFound
	}
	return user, err
}

func (repository IdentityRepository) EmailExists(ctx context.Context, email string) (bool, error) {
	var count int64
	err := repository.db.WithContext(ctx).Model(&User{}).Where("email = ?", email).Count(&count).Error
	return count > 0, err
}

func (repository IdentityRepository) CreateUser(ctx context.Context, user *User) error {
	return repository.db.WithContext(ctx).Create(user).Error
}

func (repository IdentityRepository) UpdateUser(ctx context.Context, userID uint64, values map[string]any) error {
	return repository.db.WithContext(ctx).Model(&User{}).Where("id = ?", userID).Updates(values).Error
}

func (repository IdentityRepository) InvalidateCodes(ctx context.Context, email, purpose string) error {
	return repository.db.WithContext(ctx).Model(&EmailVerificationCode{}).
		Where("email = ? AND purpose = ? AND used_at IS NULL", email, purpose).
		Update("used_at", time.Now()).Error
}

func (repository IdentityRepository) CreateCode(ctx context.Context, code *EmailVerificationCode) error {
	return repository.db.WithContext(ctx).Create(code).Error
}

func (repository IdentityRepository) LatestActiveCode(ctx context.Context, email, purpose string, lock bool) (EmailVerificationCode, error) {
	var code EmailVerificationCode
	query := repository.db.WithContext(ctx).
		Where("email = ? AND purpose = ? AND used_at IS NULL AND expires_at > ?", email, purpose, time.Now()).
		Order("id DESC")
	if lock {
		query = query.Clauses(persistencemysql.ForUpdate)
	}
	err := query.First(&code).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return EmailVerificationCode{}, ErrNotFound
	}
	return code, err
}

func (repository IdentityRepository) MarkCodeUsed(ctx context.Context, codeID uint64) (bool, error) {
	result := repository.db.WithContext(ctx).Model(&EmailVerificationCode{}).
		Where("id = ? AND used_at IS NULL", codeID).
		Update("used_at", time.Now())
	return result.RowsAffected == 1, result.Error
}
