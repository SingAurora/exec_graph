package identity

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
	sharedid "github.com/singaurora/exec-graph/backend/internal/shared/id"
)

// SendCode 发送注册、换绑或重置密码所需的邮箱验证码。
func (s *Service) SendCode(ctx context.Context, input SendCodeInput) error {
	purpose := strings.TrimSpace(input.Purpose)
	if purpose == "" {
		purpose = PurposeRegister
	}
	if purpose != PurposeRegister && purpose != PurposeChangeEmail && purpose != PurposeChangePassword && purpose != PurposeResetPassword {
		return ErrInvalidPurpose
	}
	if (purpose == PurposeChangeEmail || purpose == PurposeChangePassword) && input.CurrentUser == nil {
		return ErrUnauthenticated
	}
	email, err := NormalizeEmail(input.Email)
	if purpose == PurposeChangePassword {
		email, err = input.CurrentUser.Email, nil
	}
	if err != nil {
		return ErrInvalidEmail
	}
	if purpose == PurposeChangeEmail && email == input.CurrentUser.Email {
		return ErrEmailUnchanged
	}

	ctx, cancel := context.WithTimeout(ctx, sharedconstants.VerificationCodeTimeout)
	defer cancel()
	exists, err := s.repository.EmailExists(ctx, email)
	if err != nil {
		return err
	}
	if exists && (purpose == PurposeRegister || purpose == PurposeChangeEmail) {
		return ErrEmailRegistered
	}
	if !exists && purpose == PurposeResetPassword {
		return ErrEmailNotFound
	}
	code, err := newVerificationCode()
	if err != nil {
		return err
	}
	if err := s.mailer.SendVerificationCode(ctx, email, code); err != nil {
		return fmt.Errorf("send verification email: %w", err)
	}
	return s.repository.Transaction(ctx, func(tx Repository) error {
		if err := tx.InvalidateCodes(ctx, email, purpose); err != nil {
			return err
		}
		return tx.CreateCode(ctx, &VerificationCodeRecord{
			Email:     email,
			Purpose:   purpose,
			CodeHash:  hashValue(code),
			ExpiresAt: time.Now().Add(s.codeTTL),
			SendIP:    &input.ClientIP,
		})
	})
}

// Register 创建用户并建立其初始项目。
func (s *Service) Register(ctx context.Context, input RegisterInput) (User, string, error) {
	username := strings.TrimSpace(input.Username)
	if len([]rune(username)) < 2 || len([]rune(username)) > 64 {
		return User{}, "", ErrInvalidUsername
	}
	email, err := NormalizeEmail(input.Email)
	if err != nil {
		return User{}, "", ErrInvalidEmail
	}
	if len(input.Password) < 6 {
		return User{}, "", ErrInvalidPassword
	}
	if !verificationCodePattern.MatchString(input.Code) {
		return User{}, "", ErrInvalidCode
	}
	passwordHash, err := s.passwords.Hash(input.Password)
	if err != nil {
		return User{}, "", fmt.Errorf("hash password: %w", err)
	}
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	var databaseUserID uint64
	var handle string
	err = s.repository.Transaction(ctx, func(tx Repository) error {
		if err := consumeVerificationCode(ctx, tx, email, PurposeRegister, input.Code); err != nil {
			return err
		}
		for attempt := 0; attempt < 3; attempt++ {
			candidate, err := newUserID()
			if err != nil {
				return err
			}
			now := time.Now()
			user := UserRecord{Username: username, UserID: candidate, Email: email, PasswordHash: passwordHash, EmailVerifiedAt: &now}
			if err := tx.CreateUser(ctx, &user); err != nil {
				if strings.Contains(strings.ToLower(err.Error()), "uq_users_user_id") {
					continue
				}
				return err
			}
			databaseUserID, handle = user.ID, candidate
			break
		}
		if databaseUserID == 0 {
			return errors.New("could not allocate user handle")
		}
		contractVersion, err := s.contracts.FindVersionByID(ctx, GeneralSmartContractID)
		if err != nil {
			return err
		}
		projectUUID, err := sharedid.UUID()
		if err != nil {
			return err
		}
		revisionUUID, err := sharedid.UUID()
		if err != nil {
			return err
		}
		return tx.EnsureInitialProject(ctx, InitialProjectInput{
			ProjectUUID:          projectUUID,
			RevisionUUID:         revisionUUID,
			OwnerID:              databaseUserID,
			SmartContractUUID:    GeneralSmartContractID,
			SmartContractVersion: contractVersion,
		})
	})
	if err != nil {
		return User{}, "", err
	}
	user := User{ID: databaseUserID, Username: username, UserID: handle, Email: email}
	token, err := s.CreateSession(ctx, user)
	if err != nil {
		return user, "", err
	}
	return user, token, nil
}

// Login 校验凭据并创建登录会话。
func (s *Service) Login(ctx context.Context, input LoginInput) (User, string, error) {
	email, err := NormalizeEmail(input.Email)
	if err != nil || strings.TrimSpace(input.Password) == "" {
		return User{}, "", ErrInvalidCredentials
	}
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	stored, err := s.repository.FindUserByEmail(ctx, email, false)
	if errors.Is(err, ErrRecordNotFound) {
		return User{}, "", ErrInvalidCredentials
	}
	if err != nil {
		return User{}, "", err
	}
	if !s.passwords.Verify(stored.PasswordHash, input.Password) {
		return User{}, "", ErrInvalidCredentials
	}
	user := User{ID: stored.ID, Username: stored.Username, UserID: stored.UserID, Email: stored.Email}
	token, err := s.CreateSession(ctx, user)
	return user, token, err
}
