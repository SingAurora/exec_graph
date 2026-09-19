// Package identity contains account, verification and session use cases.
// It deliberately does not import net/http or Gin.
package identity

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/mail"
	"regexp"
	"strings"
	"time"

	infrastructuremail "github.com/singaurora/exec-graph/backend/internal/infrastructure/mail"
	contractpersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/contract"
	identitypersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/identity"
	projectpersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/project"
	infrastructureredis "github.com/singaurora/exec-graph/backend/internal/infrastructure/redis"
	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
	sharedid "github.com/singaurora/exec-graph/backend/internal/shared/id"
)

const GeneralSmartContractID = "smart-contract-general"

const (
	PurposeRegister       = "register"
	PurposeChangeEmail    = "change_email"
	PurposeChangePassword = "change_password"
	PurposeResetPassword  = "reset_password"
)

var (
	ErrUnauthenticated     = errors.New("unauthenticated")
	ErrInvalidEmail        = errors.New("invalid email")
	ErrInvalidPurpose      = errors.New("invalid verification purpose")
	ErrEmailUnchanged      = errors.New("email unchanged")
	ErrEmailRegistered     = errors.New("email already registered")
	ErrEmailNotFound       = errors.New("email not found")
	ErrInvalidCode         = errors.New("invalid verification code")
	ErrInvalidUsername     = errors.New("invalid username")
	ErrInvalidPassword     = errors.New("invalid password")
	ErrInvalidCredentials  = errors.New("invalid credentials")
	ErrCurrentPassword     = errors.New("current password incorrect")
	ErrMissingSessionToken = errors.New("missing session token")
)

var verificationCodePattern = regexp.MustCompile(`^\d{6}$`)
var userIDPattern = regexp.MustCompile(`^[A-Za-z0-9_]{2,24}$`)

type Dependencies struct {
	Repository identitypersistence.IdentityRepository
	Contracts  contractpersistence.SmartContractRepository
	Mailer     *infrastructuremail.Mailer
	Sessions   *infrastructureredis.SessionStore
	CodeTTL    time.Duration
	SessionTTL time.Duration
}

type Service struct {
	repository identitypersistence.IdentityRepository
	contracts  contractpersistence.SmartContractRepository
	mailer     *infrastructuremail.Mailer
	sessions   *infrastructureredis.SessionStore
	codeTTL    time.Duration
	sessionTTL time.Duration
}

func New(dependencies Dependencies) *Service {
	return &Service{repository: dependencies.Repository, contracts: dependencies.Contracts, mailer: dependencies.Mailer, sessions: dependencies.Sessions, codeTTL: dependencies.CodeTTL, sessionTTL: dependencies.SessionTTL}
}

type User struct {
	ID       uint64 `json:"id"`
	Username string `json:"username"`
	UserID   string `json:"userId"`
	Email    string `json:"email"`
}

type SendCodeInput struct {
	Email       string
	Purpose     string
	CurrentUser *User
	ClientIP    string
}

type RegisterInput struct{ Username, Email, Password, Code string }
type LoginInput struct{ Email, Password string }
type ChangeEmailInput struct {
	User                                User
	Email, CurrentPassword, Code, Token string
}
type ChangePasswordInput struct {
	User                                User
	CurrentPassword, NextPassword, Code string
}
type ResetPasswordInput struct{ Email, NextPassword, Code string }

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
	repository := s.repository
	exists, err := repository.EmailExists(ctx, email)
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
	return repository.Transaction(ctx, func(tx identitypersistence.IdentityRepository) error {
		if err := tx.InvalidateCodes(ctx, email, purpose); err != nil {
			return err
		}
		return tx.CreateCode(ctx, &identitypersistence.EmailVerificationCode{Email: email, Purpose: purpose, CodeHash: hashValue(code), ExpiresAt: time.Now().Add(s.codeTTL), SendIP: &input.ClientIP})
	})
}

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
	repository := s.repository
	err = repository.Transaction(ctx, func(tx identitypersistence.IdentityRepository) error {
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
		return tx.ProjectRepository().EnsureInitialProject(ctx, projectpersistence.InitialProjectSpec{ProjectID: fmt.Sprintf("project-initial-%d", databaseUserID), RevisionID: fmt.Sprintf("project-initial-revision-%d", databaseUserID), OwnerID: databaseUserID, SmartContractID: GeneralSmartContractID, SmartContractVersion: contract.Version})
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
	repository := s.repository
	err = repository.Transaction(ctx, func(tx identitypersistence.IdentityRepository) error {
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

func (s *Service) ChangePassword(ctx context.Context, input ChangePasswordInput) error {
	if len(input.NextPassword) < 6 {
		return ErrInvalidPassword
	}
	if strings.TrimSpace(input.CurrentPassword) == "" || !verificationCodePattern.MatchString(input.Code) {
		return ErrInvalidCode
	}
	ctx, cancel := context.WithTimeout(ctx, sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	repository := s.repository
	err := repository.Transaction(ctx, func(tx identitypersistence.IdentityRepository) error {
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
	repository := s.repository
	var userID uint64
	err = repository.Transaction(ctx, func(tx identitypersistence.IdentityRepository) error {
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

func (s *Service) CreateSession(ctx context.Context, user User) (string, error) {
	token, err := newSessionToken()
	if err != nil {
		return "", err
	}
	return token, s.CacheSession(ctx, token, user)
}
func (s *Service) Authenticate(ctx context.Context, token string) (User, error) {
	user, ok, err := s.LoadSession(ctx, token)
	if err != nil {
		return User{}, err
	}
	if !ok {
		return User{}, ErrUnauthenticated
	}
	return user, nil
}
func (s *Service) CacheSession(ctx context.Context, token string, user User) error {
	if token == "" {
		return ErrMissingSessionToken
	}
	data, err := json.Marshal(user)
	if err != nil {
		return err
	}
	return s.sessions.Store(ctx, token, user.ID, data, s.sessionTTL)
}
func (s *Service) LoadSession(ctx context.Context, token string) (User, bool, error) {
	if token == "" {
		return User{}, false, nil
	}
	data, ok, err := s.sessions.Load(ctx, token)
	if err != nil || !ok {
		return User{}, ok, err
	}
	var user User
	if json.Unmarshal(data, &user) != nil || user.ID == 0 {
		_ = s.sessions.Delete(ctx, token, 0)
		return User{}, false, nil
	}
	return user, true, nil
}
func (s *Service) DeleteSession(ctx context.Context, token string) error {
	if token == "" {
		return nil
	}
	user, ok, err := s.LoadSession(ctx, token)
	if err != nil {
		return err
	}
	var userID uint64
	if ok {
		userID = user.ID
	}
	return s.sessions.Delete(ctx, token, userID)
}
func (s *Service) DeleteUserSessions(ctx context.Context, userID uint64) error {
	return s.sessions.DeleteUserSessions(ctx, userID)
}

func NormalizeUserID(value string) (string, error) {
	userID := strings.TrimPrefix(strings.TrimSpace(value), "@")
	if !userIDPattern.MatchString(userID) {
		return "", ErrInvalidUsername
	}
	return userID, nil
}
func NormalizeEmail(value string) (string, error) {
	email := strings.ToLower(strings.TrimSpace(value))
	parsed, err := mail.ParseAddress(email)
	if err != nil || parsed.Address != email || !strings.Contains(email, "@") {
		return "", ErrInvalidEmail
	}
	return email, nil
}
func consumeVerificationCode(ctx context.Context, repository identitypersistence.IdentityRepository, email, purpose, code string) error {
	verification, err := repository.LatestActiveCode(ctx, email, purpose, true)
	if errors.Is(err, identitypersistence.ErrNotFound) || !equalHash(verification.CodeHash, code) {
		return ErrInvalidCode
	}
	if err != nil {
		return err
	}
	used, err := repository.MarkCodeUsed(ctx, verification.ID)
	if err != nil {
		return err
	}
	if !used {
		return ErrInvalidCode
	}
	return nil
}
func newVerificationCode() (string, error) {
	number, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", number.Int64()), nil
}
func newUserID() (string, error)       { return sharedid.User() }
func newSessionToken() (string, error) { return sharedid.SessionToken() }
func hashValue(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}
func equalHash(expectedHash, value string) bool {
	return expectedHash != "" && expectedHash == hashValue(value)
}
