package account

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"net/mail"
	"strings"
	"time"

	"github.com/singaurora/exec-graph/backend/internal/application/identity"
	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
	"github.com/singaurora/exec-graph/backend/internal/shared/textinput"
)

// Service 组合认证、验证码与账户仓储，业务层不感知 SDK、Redis 或 HTTP。
type Service struct {
	repo      Repository
	codes     Codes
	sender    Sender
	passwords identity.Passwords
	auth      *identity.Service
	ttl       time.Duration
}

// New 创建账户安全用例，验证码有效期来自已校验配置。
func New(repo Repository, codes Codes, sender Sender, passwords identity.Passwords, auth *identity.Service, ttl time.Duration) *Service {
	return &Service{repo, codes, sender, passwords, auth, ttl}
}

func emailAddress(value string) (string, error) {
	value = strings.ToLower(strings.TrimSpace(value))
	if len(value) > constants.EmailMaxBytes {
		return "", fault.New(fault.Invalid, "邮箱最多 254 字节")
	}
	parsed, err := mail.ParseAddress(value)
	if err != nil || parsed.Address != value || textinput.HasUnsafeCharacters(value) || !strings.Contains(value, ".") {
		return "", fault.New(fault.Invalid, "请输入有效的邮箱地址")
	}
	return value, nil
}

func codeScope(purpose, user string) string { return purpose + ":" + user }

// SendCode 区分公开认证与需会话的安全操作；所有验证码绑定用途、邮箱和必要的账号身份。
func (s *Service) SendCode(ctx context.Context, actor identity.Actor, input CodeInput, source string) (CodeView, error) {
	out := CodeView{ExpiresIn: int(s.ttl.Seconds()), RetryAfter: int(constants.CodeResendInterval.Seconds())}
	email, err := emailAddress(input.Email)
	if err != nil {
		return out, err
	}
	user := ""
	switch input.Purpose {
	case "register", "reset-password":
	case "change-password", "change-email":
		account, err := s.repo.ByUUID(ctx, actor.UserID)
		if err != nil {
			return out, err
		}
		if account.View.ID == "" || account.Disabled || account.AuthVersion != actor.AuthVersion {
			return out, fault.New(fault.Unauthenticated, "请重新登录")
		}
		if input.Purpose == "change-password" && email != account.View.Email {
			return out, fault.New(fault.Invalid, "请向当前绑定邮箱发送验证码")
		}
		if input.Purpose == "change-email" && email == account.View.Email {
			return out, fault.New(fault.Invalid, "新邮箱不能与当前邮箱相同")
		}
		user = actor.UserID
	default:
		return out, fault.New(fault.Invalid, "验证码用途不合法")
	}
	for _, limit := range []struct {
		key    string
		count  int
		window time.Duration
	}{{"mail-source:" + source, constants.CodeSourceLimit, constants.CodeSourceWindow}, {"mail-target:" + input.Purpose + ":" + email, 1, constants.CodeResendInterval}} {
		allowed, err := s.codes.Allow(ctx, limit.key, limit.count, limit.window)
		if err != nil {
			return out, err
		}
		if !allowed {
			return out, fault.New(fault.TooMany, "验证码发送过于频繁，请稍后再试")
		}
	}
	number, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return out, err
	}
	code, scope := fmt.Sprintf("%06d", number.Int64()), codeScope(input.Purpose, user)
	if err := s.codes.Issue(ctx, scope, email, code, s.ttl); err != nil {
		return out, err
	}
	if err := s.sender.SendCode(ctx, email, code, s.ttl); err != nil {
		cleanup, cancel := context.WithTimeout(context.WithoutCancel(ctx), constants.DependencyTimeout)
		defer cancel()
		return out, errors.Join(fault.New(fault.Unavailable, "验证码邮件发送失败，请稍后重试"), s.codes.Revoke(cleanup, scope, email))
	}
	return out, nil
}

func (s *Service) verify(ctx context.Context, purpose, user, email, code string) error {
	if len(code) != 6 {
		return fault.New(fault.Invalid, "请输入六位数字验证码")
	}
	for _, digit := range code {
		if digit < '0' || digit > '9' {
			return fault.New(fault.Invalid, "请输入六位数字验证码")
		}
	}
	valid, err := s.codes.Consume(ctx, codeScope(purpose, user), email, code)
	if err != nil {
		return err
	}
	if !valid {
		return fault.New(fault.Invalid, "验证码错误、已使用或已过期，请重新获取")
	}
	return nil
}
