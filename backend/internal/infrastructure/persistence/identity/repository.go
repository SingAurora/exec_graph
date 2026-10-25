// Package identity 实现账户持久化读取。
package identity

import (
	"context"
	"errors"
	"fmt"

	app "github.com/singaurora/exec-graph/backend/internal/application/identity"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/catalogue"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
	"gorm.io/gorm"
)

// Repository 将私有凭据和公开资料组合，仅交给身份用例。
type Repository struct {
	db       *gorm.DB
	profiles *catalogue.Repository
}

// New 注入数据库和公开资料读取器。
func New(db *gorm.DB, profiles *catalogue.Repository) *Repository { return &Repository{db, profiles} }

// ByEmail 按规范化邮箱读取私有账户，不存在时返回空身份。
func (r *Repository) ByEmail(ctx context.Context, email string) (app.Account, error) {
	var credential model.UserCredential
	err := r.db.WithContext(ctx).Where("email = ?", email).Take(&credential).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return app.Account{}, nil
	}
	if err != nil {
		return app.Account{}, fmt.Errorf("读取凭据: %w", err)
	}
	return r.ByUUID(ctx, credential.UserUUID)
}

// ByUUID 每次从 MySQL 读取认证版本，防止已撤销会话继续使用。
func (r *Repository) ByUUID(ctx context.Context, uuid string) (app.Account, error) {
	var user model.User
	err := r.db.WithContext(ctx).Where("uuid = ?", uuid).Take(&user).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return app.Account{}, nil
	}
	if err != nil {
		return app.Account{}, err
	}
	var credential model.UserCredential
	err = r.db.WithContext(ctx).Where("user_uuid = ?", uuid).Take(&credential).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return app.Account{}, nil
	}
	if err != nil {
		return app.Account{}, err
	}
	profile, err := r.profiles.Profile(ctx, uuid)
	if err != nil {
		return app.Account{}, err
	}
	dataset := ""
	if user.TestDataset != nil {
		dataset = *user.TestDataset
	}
	return app.Account{View: app.AccountView{ProfileView: profile, Email: credential.Email, IsTestAccount: user.IsTestAccount, Version: user.Version}, PasswordHash: credential.PasswordHash, AuthVersion: credential.AuthVersion, Disabled: user.DisabledAt != nil, TestDataset: dataset}, nil
}
