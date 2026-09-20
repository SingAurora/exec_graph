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
	"strings"

	sharedid "github.com/singaurora/exec-graph/backend/internal/shared/id"
)

// CreateSession 创建一个新的登录会话。
func (s *Service) CreateSession(ctx context.Context, user User) (string, error) {
	token, err := newSessionToken()
	if err != nil {
		return "", err
	}
	return token, s.CacheSession(ctx, token, user)
}

// Authenticate 根据会话令牌加载当前用户。
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

// CacheSession 保存用户会话。
func (s *Service) CacheSession(ctx context.Context, token string, user User) error {
	if token == "" {
		return ErrMissingSessionToken
	}
	data, err := json.Marshal(sessionUser{
		ID:       user.ID,
		Username: user.Username,
		UserID:   user.UserID,
		Email:    user.Email,
	})
	if err != nil {
		return err
	}
	return s.sessions.Store(ctx, token, user.ID, data, s.sessionTTL)
}

// LoadSession 加载会话；令牌不存在或内容失效时返回 false。
func (s *Service) LoadSession(ctx context.Context, token string) (User, bool, error) {
	if token == "" {
		return User{}, false, nil
	}
	data, ok, err := s.sessions.Load(ctx, token)
	if err != nil || !ok {
		return User{}, ok, err
	}
	var stored sessionUser
	if json.Unmarshal(data, &stored) != nil || stored.ID == 0 {
		_ = s.sessions.Delete(ctx, token, 0)
		return User{}, false, nil
	}
	return User{ID: stored.ID, Username: stored.Username, UserID: stored.UserID, Email: stored.Email}, true, nil
}

// DeleteSession 删除一个登录会话。
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

// DeleteUserSessions 删除用户的全部登录会话。
func (s *Service) DeleteUserSessions(ctx context.Context, userID uint64) error {
	return s.sessions.DeleteUserSessions(ctx, userID)
}

// NormalizeUserID 规范化并校验用户公开标识。
func NormalizeUserID(value string) (string, error) {
	userID := strings.TrimPrefix(strings.TrimSpace(value), "@")
	if !userIDPattern.MatchString(userID) {
		return "", ErrInvalidUsername
	}
	return userID, nil
}

// NormalizeEmail 规范化并校验邮箱地址。
func NormalizeEmail(value string) (string, error) {
	email := strings.ToLower(strings.TrimSpace(value))
	parsed, err := mail.ParseAddress(email)
	if err != nil || parsed.Address != email || !strings.Contains(email, "@") {
		return "", ErrInvalidEmail
	}
	return email, nil
}

func consumeVerificationCode(ctx context.Context, repository Repository, email, purpose, code string) error {
	verification, err := repository.LatestActiveCode(ctx, email, purpose, true)
	if errors.Is(err, ErrRecordNotFound) || !equalHash(verification.CodeHash, code) {
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

// sessionUser 是 Redis 中保存的内部会话载荷，不会被 HTTP 直接返回。
type sessionUser struct {
	ID       uint64 `json:"id"`
	Username string `json:"username"`
	UserID   string `json:"userId"`
	Email    string `json:"email"`
}
