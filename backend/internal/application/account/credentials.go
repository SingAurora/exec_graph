package account

import (
	"context"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/singaurora/exec-graph/backend/internal/application/identity"
	"github.com/singaurora/exec-graph/backend/internal/application/profile"
	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
	"github.com/singaurora/exec-graph/backend/internal/shared/textinput"
)

func validateNewPassword(password string) error {
	if strings.ContainsFunc(password, unicode.IsSpace) {
		return fault.New(fault.Invalid, "密码不能包含空格或其他空白字符")
	}
	if !utf8.ValidString(password) || textinput.HasUnsafeCharacters(password) {
		return fault.New(fault.Invalid, "密码不能包含控制字符或不可见格式字符")
	}
	if utf8.RuneCountInString(password) < constants.PasswordMinCharacters {
		return fault.New(fault.Invalid, "密码至少需要 8 位")
	}
	if len(password) > constants.PasswordMaxBytes {
		return fault.New(fault.Invalid, "密码最多 256 字节")
	}
	return nil
}

// Register 仅在成功消耗邮箱验证码后建号，再创建真实服务端会话。
func (s *Service) Register(ctx context.Context, input RegisterInput, source string) (identity.LoginResult, error) {
	email, err := emailAddress(input.Email)
	if err != nil {
		return identity.LoginResult{}, err
	}
	input.Name, err = profile.NormalizeName(input.Name)
	if err != nil {
		return identity.LoginResult{}, err
	}
	if err := validateNewPassword(input.Password); err != nil {
		return identity.LoginResult{}, err
	}
	if err := s.verify(ctx, "register", "", email, input.Code); err != nil {
		return identity.LoginResult{}, err
	}
	hash, err := s.passwords.Hash(input.Password)
	if err != nil {
		return identity.LoginResult{}, err
	}
	if err := s.repo.Register(ctx, Registration{UUID: id.New(), Email: email, PasswordHash: hash, Name: input.Name, VerifiedAt: time.Now().UTC()}); err != nil {
		return identity.LoginResult{}, err
	}
	return s.auth.Login(ctx, email, input.Password, source)
}

// ResetPassword 消耗一次性验证码，并在数据库事务中递增认证版本撤销全部旧会话。
func (s *Service) ResetPassword(ctx context.Context, input ResetInput) error {
	email, err := emailAddress(input.Email)
	if err != nil {
		return err
	}
	if err := validateNewPassword(input.Password); err != nil {
		return err
	}
	if err := s.verify(ctx, "reset-password", "", email, input.Code); err != nil {
		return err
	}
	account, err := s.repo.ByEmail(ctx, email)
	if err != nil {
		return err
	}
	if account.View.ID == "" || account.Disabled {
		return fault.New(fault.Invalid, "当前邮箱无法重置密码")
	}
	if s.passwords.Verify(account.PasswordHash, input.Password) {
		return fault.New(fault.Invalid, "新密码不能与当前密码相同")
	}
	hash, err := s.passwords.Hash(input.Password)
	if err != nil {
		return err
	}
	return s.repo.ReplacePassword(ctx, identity.Actor{UserID: account.View.ID, AuthVersion: account.AuthVersion}, account.PasswordHash, hash)
}

func (s *Service) current(ctx context.Context, actor identity.Actor, password string) (identity.Account, error) {
	account, err := s.repo.ByUUID(ctx, actor.UserID)
	if err != nil {
		return account, err
	}
	if account.View.ID == "" || account.Disabled || account.AuthVersion != actor.AuthVersion {
		return account, fault.New(fault.Unauthenticated, "会话已失效，请重新登录")
	}
	if len(password) > constants.PasswordMaxBytes || !s.passwords.Verify(account.PasswordHash, password) {
		return account, fault.New(fault.Invalid, "当前密码不正确")
	}
	return account, nil
}

// ChangePassword 同时验证当前密码与绑定邮箱，成功后需要重新登录。
func (s *Service) ChangePassword(ctx context.Context, actor identity.Actor, input ChangePasswordInput) (struct{}, error) {
	account, err := s.current(ctx, actor, input.CurrentPassword)
	if err != nil {
		return struct{}{}, err
	}
	if err := validateNewPassword(input.Password); err != nil {
		return struct{}{}, err
	}
	if s.passwords.Verify(account.PasswordHash, input.Password) {
		return struct{}{}, fault.New(fault.Invalid, "新密码不能与当前密码相同")
	}
	if err := s.verify(ctx, "change-password", actor.UserID, account.View.Email, input.Code); err != nil {
		return struct{}{}, err
	}
	hash, err := s.passwords.Hash(input.Password)
	if err != nil {
		return struct{}{}, err
	}
	return struct{}{}, s.repo.ReplacePassword(ctx, actor, account.PasswordHash, hash)
}

// ChangeEmail 同时验证密码和新邮箱，递增认证版本后要求重新登录。
func (s *Service) ChangeEmail(ctx context.Context, actor identity.Actor, input ChangeEmailInput) (struct{}, error) {
	account, err := s.current(ctx, actor, input.CurrentPassword)
	if err != nil {
		return struct{}{}, err
	}
	email, err := emailAddress(input.Email)
	if err != nil {
		return struct{}{}, err
	}
	if email == account.View.Email {
		return struct{}{}, fault.New(fault.Invalid, "新邮箱不能与当前邮箱相同")
	}
	if err := s.verify(ctx, "change-email", actor.UserID, email, input.Code); err != nil {
		return struct{}{}, err
	}
	return struct{}{}, s.repo.ReplaceEmail(ctx, actor, account.PasswordHash, email)
}
