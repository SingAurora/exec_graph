package identity

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	identitypersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/identity"
	projectpersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/project"
	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
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
	return s.repository.Transaction(ctx, func(tx identitypersistence.IdentityRepository) error {
		if err := tx.InvalidateCodes(ctx, email, purpose); err != nil {
			return err
		}
		return tx.CreateCode(ctx, &identitypersistence.EmailVerificationCode{
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
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	var databaseUserID uint64
	var handle string
	err = s.repository.Transaction(ctx, func(tx identitypersistence.IdentityRepository) error {
		if err := consumeVerificationCode(ctx, tx, email, PurposeRegister, input.Code); err != nil {
			return err
		}
		for attempt := 0; attempt < 3; attempt++ {
			candidate, err := newUserID()
			if err != nil {
				return err
			}
			now := time.Now()
			user := identitypersistence.User{Username: username, UserID: candidate, Email: email, PasswordHash: input.Password, EmailVerifiedAt: &now}
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
		contract, err := s.contracts.FindByID(ctx, GeneralSmartContractID)
		if err != nil {
			return err
		}
		return tx.ProjectRepository().EnsureInitialProject(ctx, projectpersistence.InitialProjectSpec{
			ProjectID:            fmt.Sprintf("project-initial-%d", databaseUserID),
			RevisionID:           fmt.Sprintf("project-initial-revision-%d", databaseUserID),
			OwnerID:              databaseUserID,
			SmartContractID:      GeneralSmartContractID,
			SmartContractVersion: contract.Version,
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
	if errors.Is(err, identitypersistence.ErrNotFound) || stored.PasswordHash != input.Password {
		return User{}, "", ErrInvalidCredentials
	}
	if err != nil {
		return User{}, "", err
	}
	user := User{ID: stored.ID, Username: stored.Username, UserID: stored.UserID, Email: stored.Email}
	token, err := s.CreateSession(ctx, user)
	return user, token, err
}
