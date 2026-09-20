package identity

import (
	"context"
	"errors"
	"time"

	applicationidentity "github.com/singaurora/exec-graph/backend/internal/application/identity"
	persistencemysql "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/mysql"
	projectpersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/project"
	"gorm.io/gorm"
)

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

func (repository IdentityRepository) Transaction(ctx context.Context, fn func(tx applicationidentity.Repository) error) error {
	return repository.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		return fn(IdentityRepository{db: tx})
	})
}

func (repository IdentityRepository) FindUserByEmail(ctx context.Context, email string, lock bool) (applicationidentity.UserRecord, error) {
	var user User
	query := repository.db.WithContext(ctx).Where("email = ?", email)
	if lock {
		query = query.Clauses(persistencemysql.ForUpdate)
	}
	err := query.First(&user).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return applicationidentity.UserRecord{}, applicationidentity.ErrRecordNotFound
	}
	return userRecordFromModel(user), err
}

func (repository IdentityRepository) FindUserByID(ctx context.Context, userID uint64) (applicationidentity.UserRecord, error) {
	var user User
	err := repository.db.WithContext(ctx).First(&user, userID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return applicationidentity.UserRecord{}, applicationidentity.ErrRecordNotFound
	}
	return userRecordFromModel(user), err
}

func (repository IdentityRepository) EmailExists(ctx context.Context, email string) (bool, error) {
	var count int64
	err := repository.db.WithContext(ctx).Model(&User{}).Where("email = ?", email).Count(&count).Error
	return count > 0, err
}

func (repository IdentityRepository) CreateUser(ctx context.Context, user *applicationidentity.UserRecord) error {
	model := userModelFromRecord(*user)
	if err := repository.db.WithContext(ctx).Create(&model).Error; err != nil {
		return err
	}
	*user = userRecordFromModel(model)
	return nil
}

func (repository IdentityRepository) UpdateEmail(ctx context.Context, userID uint64, email string, verifiedAt time.Time) error {
	return repository.db.WithContext(ctx).Model(&User{}).Where("id = ?", userID).Updates(map[string]any{"email": email, "email_verified_at": verifiedAt}).Error
}

func (repository IdentityRepository) UpdatePassword(ctx context.Context, userID uint64, passwordHash string) error {
	return repository.db.WithContext(ctx).Model(&User{}).Where("id = ?", userID).Update("password_hash", passwordHash).Error
}

func (repository IdentityRepository) UpdateProfile(ctx context.Context, userID uint64, input applicationidentity.ProfileUpdateRecord) error {
	return repository.db.WithContext(ctx).Model(&User{}).Where("id = ?", userID).Updates(map[string]any{
		"username": input.Username, "user_id": input.UserID, "bio": input.Bio, "gender": input.Gender,
		"custom_profile_enabled": input.CustomProfileEnabled, "custom_profile_markdown": input.CustomProfileMarkdown,
	}).Error
}

func (repository IdentityRepository) SetAvatarObjectKey(ctx context.Context, userID uint64, objectKey string) error {
	return repository.db.WithContext(ctx).Model(&User{}).Where("id = ?", userID).Update("avatar_url", objectKey).Error
}

func (repository IdentityRepository) SetProfileBackgroundObjectKey(ctx context.Context, userID uint64, objectKey string) error {
	return repository.db.WithContext(ctx).Model(&User{}).Where("id = ?", userID).Update("profile_background_url", objectKey).Error
}

func (repository IdentityRepository) InvalidateCodes(ctx context.Context, email, purpose string) error {
	return repository.db.WithContext(ctx).Model(&EmailVerificationCode{}).
		Where("email = ? AND purpose = ? AND used_at IS NULL", email, purpose).
		Update("used_at", time.Now()).Error
}

func (repository IdentityRepository) CreateCode(ctx context.Context, code *applicationidentity.VerificationCodeRecord) error {
	model := verificationCodeModelFromRecord(*code)
	if err := repository.db.WithContext(ctx).Create(&model).Error; err != nil {
		return err
	}
	*code = verificationCodeRecordFromModel(model)
	return nil
}

func (repository IdentityRepository) LatestActiveCode(ctx context.Context, email, purpose string, lock bool) (applicationidentity.VerificationCodeRecord, error) {
	var code EmailVerificationCode
	query := repository.db.WithContext(ctx).
		Where("email = ? AND purpose = ? AND used_at IS NULL AND expires_at > ?", email, purpose, time.Now()).
		Order("id DESC")
	if lock {
		query = query.Clauses(persistencemysql.ForUpdate)
	}
	err := query.First(&code).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return applicationidentity.VerificationCodeRecord{}, applicationidentity.ErrRecordNotFound
	}
	return verificationCodeRecordFromModel(code), err
}

func (repository IdentityRepository) EnsureInitialProject(ctx context.Context, input applicationidentity.InitialProjectInput) error {
	return projectpersistence.NewProjectRepository(repository.db).EnsureInitialProject(ctx, projectpersistence.InitialProjectSpec{
		ProjectID: input.ProjectUUID, RevisionID: input.RevisionUUID, OwnerID: input.OwnerID,
		SmartContractID: input.SmartContractUUID, SmartContractVersion: input.SmartContractVersion,
	})
}

func userModelFromRecord(record applicationidentity.UserRecord) User {
	return User{
		ID: record.ID, Username: record.Username, UserID: record.UserID, IsTestAccount: record.IsTestAccount,
		Email: record.Email, PasswordHash: record.PasswordHash, EmailVerifiedAt: record.EmailVerifiedAt,
		Bio: record.Bio, Gender: record.Gender, AvatarURL: record.AvatarObjectKey,
		ProfileBackgroundURL: record.ProfileBackgroundKey, CustomProfileEnabled: record.CustomProfileEnabled,
		CustomProfileMarkdown: record.CustomProfileMarkdown, CreatedAt: record.CreatedAt, UpdatedAt: record.UpdatedAt,
	}
}

func userRecordFromModel(model User) applicationidentity.UserRecord {
	return applicationidentity.UserRecord{
		ID: model.ID, Username: model.Username, UserID: model.UserID, IsTestAccount: model.IsTestAccount,
		Email: model.Email, PasswordHash: model.PasswordHash, EmailVerifiedAt: model.EmailVerifiedAt,
		Bio: model.Bio, Gender: model.Gender, AvatarObjectKey: model.AvatarURL,
		ProfileBackgroundKey: model.ProfileBackgroundURL, CustomProfileEnabled: model.CustomProfileEnabled,
		CustomProfileMarkdown: model.CustomProfileMarkdown, CreatedAt: model.CreatedAt, UpdatedAt: model.UpdatedAt,
	}
}

func verificationCodeModelFromRecord(record applicationidentity.VerificationCodeRecord) EmailVerificationCode {
	return EmailVerificationCode{ID: record.ID, Email: record.Email, Purpose: record.Purpose, CodeHash: record.CodeHash, ExpiresAt: record.ExpiresAt, UsedAt: record.UsedAt, SendIP: record.SendIP, CreatedAt: record.CreatedAt}
}

func verificationCodeRecordFromModel(model EmailVerificationCode) applicationidentity.VerificationCodeRecord {
	return applicationidentity.VerificationCodeRecord{ID: model.ID, Email: model.Email, Purpose: model.Purpose, CodeHash: model.CodeHash, ExpiresAt: model.ExpiresAt, UsedAt: model.UsedAt, SendIP: model.SendIP, CreatedAt: model.CreatedAt}
}

func (repository IdentityRepository) MarkCodeUsed(ctx context.Context, codeID uint64) (bool, error) {
	result := repository.db.WithContext(ctx).Model(&EmailVerificationCode{}).
		Where("id = ? AND used_at IS NULL", codeID).
		Update("used_at", time.Now())
	return result.RowsAffected == 1, result.Error
}
