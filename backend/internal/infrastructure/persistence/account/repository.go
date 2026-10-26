// Package account 实现普通建号与凭据变更事务，不对外返回数据库内部主键。
package account

import (
	"context"
	"errors"
	"time"

	mysql "github.com/go-sql-driver/mysql"
	app "github.com/singaurora/exec-graph/backend/internal/application/account"
	"github.com/singaurora/exec-graph/backend/internal/application/identity"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/transaction"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
	"gorm.io/gorm"
)

// Repository 复用既有私有账户读取器，所有写入仍经 GORM。
type Repository struct {
	identity.Repository
	db *gorm.DB
}

// New 由组合根注入读仓储和数据库。
func New(db *gorm.DB, reader identity.Repository) *Repository { return &Repository{reader, db} }

func duplicateEmail(err error) error {
	var duplicate *mysql.MySQLError
	if errors.As(err, &duplicate) && duplicate.Number == 1062 {
		return fault.New(fault.Conflict, "该邮箱已被使用")
	}
	return err
}

// Register 原子创建用户和凭据；普通账号的测试标记始终为 false。
func (r *Repository) Register(ctx context.Context, input app.Registration) error {
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		user := model.User{UUID: input.UUID, Name: input.Name, Gender: "unknown", Version: 1, CreatedAt: input.VerifiedAt, UpdatedAt: input.VerifiedAt}
		if err := tx.Create(&user).Error; err != nil {
			return err
		}
		return tx.Create(&model.UserCredential{UserUUID: input.UUID, Email: input.Email, PasswordHash: input.PasswordHash, EmailVerifiedAt: input.VerifiedAt, AuthVersion: 1, PasswordChangedAt: input.VerifiedAt, CreatedAt: input.VerifiedAt, UpdatedAt: input.VerifiedAt}).Error
	})
	return duplicateEmail(err)
}

func checkCurrent(tx *transaction.Scope, hash string) (model.UserCredential, error) {
	var credential model.UserCredential
	if err := tx.DB.Where("user_uuid = ?", tx.Actor.UserID).Take(&credential).Error; err != nil {
		return credential, err
	}
	if credential.PasswordHash != hash {
		return credential, fault.New(fault.Conflict, "账户凭据已变化，请重新登录")
	}
	return credential, nil
}

// ReplacePassword 锁用户及凭据并递增认证版本，旧会话无需逐条扫描 Redis 即可失效。
func (r *Repository) ReplacePassword(ctx context.Context, actor identity.Actor, oldHash, newHash string) error {
	return transaction.Within(ctx, r.db, actor, func(tx *transaction.Scope) error {
		if _, err := checkCurrent(tx, oldHash); err != nil {
			return err
		}
		now := time.Now().UTC()
		return tx.DB.Model(&model.UserCredential{}).Where("user_uuid = ?", actor.UserID).Select("PasswordHash", "PasswordChangedAt", "AuthVersion", "UpdatedAt").Updates(model.UserCredential{PasswordHash: newHash, PasswordChangedAt: now, AuthVersion: actor.AuthVersion + 1, UpdatedAt: now}).Error
	})
}

// ReplaceEmail 新邮箱唯一约束与认证版本变更同事务提交。
func (r *Repository) ReplaceEmail(ctx context.Context, actor identity.Actor, oldHash, email string) error {
	err := transaction.Within(ctx, r.db, actor, func(tx *transaction.Scope) error {
		if _, err := checkCurrent(tx, oldHash); err != nil {
			return err
		}
		now := time.Now().UTC()
		return tx.DB.Model(&model.UserCredential{}).Where("user_uuid = ?", actor.UserID).Select("Email", "EmailVerifiedAt", "AuthVersion", "UpdatedAt").Updates(model.UserCredential{Email: email, EmailVerifiedAt: now, AuthVersion: actor.AuthVersion + 1, UpdatedAt: now}).Error
	})
	return duplicateEmail(err)
}
