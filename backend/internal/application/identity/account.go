package identity

import (
	"context"
	"strings"
	"time"

	identitypersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/identity"
	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
)

// ChangeEmail 修改用户邮箱并刷新当前会话。
func (s *Service) ChangeEmail(ctx context.Context, input ChangeEmailInput) (User, error) {
	email, err := NormalizeEmail(input.Email)
	if err != nil {
		return User{}, ErrInvalidEmail
	}
	if email == input.User.Email {
		return User{}, ErrEmailUnchanged
	}
	if strings.TrimSpace(input.CurrentPassword) == "" || !verificationCodePattern.MatchString(input.Code) {
		return User{}, ErrInvalidCode
	}
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	err = s.repository.Transaction(ctx, func(tx identitypersistence.IdentityRepository) error {
		stored, err := tx.FindUserByID(ctx, input.User.ID)
		if err != nil {
			return err
		}
		if stored.PasswordHash != input.CurrentPassword {
			return ErrCurrentPassword
		}
		if err := consumeVerificationCode(ctx, tx, email, PurposeChangeEmail, input.Code); err != nil {
			return err
		}
		now := time.Now()
		return tx.UpdateUser(ctx, input.User.ID, map[string]any{"email": email, "email_verified_at": now})
	})
	if err != nil {
		return User{}, err
	}
	user := input.User
	user.Email = email
	if err := s.CacheSession(ctx, input.Token, user); err != nil {
		return User{}, err
	}
	return user, nil
}

// ChangePassword 修改密码并注销该用户的其他会话。
func (s *Service) ChangePassword(ctx context.Context, input ChangePasswordInput) error {
	if len(input.NextPassword) < 6 {
		return ErrInvalidPassword
	}
	if strings.TrimSpace(input.CurrentPassword) == "" || !verificationCodePattern.MatchString(input.Code) {
		return ErrInvalidCode
	}
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	err := s.repository.Transaction(ctx, func(tx identitypersistence.IdentityRepository) error {
		stored, err := tx.FindUserByID(ctx, input.User.ID)
		if err != nil {
			return err
		}
		if stored.PasswordHash != input.CurrentPassword {
			return ErrCurrentPassword
		}
		if err := consumeVerificationCode(ctx, tx, input.User.Email, PurposeChangePassword, input.Code); err != nil {
			return err
		}
		return tx.UpdateUser(ctx, input.User.ID, map[string]any{"password_hash": input.NextPassword})
	})
	if err != nil {
		return err
	}
	return s.DeleteUserSessions(ctx, input.User.ID)
}

// ResetPassword 重置密码并注销该用户的所有会话。
func (s *Service) ResetPassword(ctx context.Context, input ResetPasswordInput) error {
	email, err := NormalizeEmail(input.Email)
	if err != nil {
		return ErrInvalidEmail
	}
	if len(input.NextPassword) < 6 || !verificationCodePattern.MatchString(input.Code) {
		return ErrInvalidCode
	}
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	var userID uint64
	err = s.repository.Transaction(ctx, func(tx identitypersistence.IdentityRepository) error {
		stored, err := tx.FindUserByEmail(ctx, email, true)
		if err != nil {
			return err
		}
		userID = stored.ID
		if err := consumeVerificationCode(ctx, tx, email, PurposeResetPassword, input.Code); err != nil {
			return err
		}
		return tx.UpdateUser(ctx, userID, map[string]any{"password_hash": input.NextPassword})
	})
	if err != nil {
		return err
	}
	return s.DeleteUserSessions(ctx, userID)
}
