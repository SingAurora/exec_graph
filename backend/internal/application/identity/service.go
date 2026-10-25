// Package identity 实现服务端会话，独立于 HTTP 和 Redis 细节。
package identity

import (
	"context"
	"crypto/subtle"
	"strings"
	"time"

	"github.com/singaurora/exec-graph/backend/internal/application/catalogue"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
)

// AccountView 仅返回给当前已认证账户。
type AccountView struct {
	catalogue.ProfileView
	Email         string `json:"email"`
	IsTestAccount bool   `json:"isTestAccount"`
	Version       uint32 `json:"version"`
}

// Account 是鉴权所需的私有账户状态。
type Account struct {
	View         AccountView
	PasswordHash string
	AuthVersion  uint32
	Disabled     bool
	TestDataset  string
}

// SessionRecord 只在会话存储内部传输。
type SessionRecord struct {
	UserUUID    string    `json:"userUuid"`
	AuthVersion uint32    `json:"authVersion"`
	CSRFToken   string    `json:"csrfToken"`
	ExpiresAt   time.Time `json:"expiresAt"`
}

// SessionView 与前端会话协议一致。
type SessionView struct {
	User      AccountView `json:"user"`
	CSRFToken string      `json:"csrfToken"`
}

// LoginResult 的 Token 仅供 HTTP 设置 HttpOnly cookie，不进入 JSON。
type LoginResult struct {
	View  SessionView
	Token string
}

// Repository 按邮箱或 UUID 读取账户。
type Repository interface {
	ByEmail(context.Context, string) (Account, error)
	ByUUID(context.Context, string) (Account, error)
}

// Sessions 隔离会话持久化和频率限制实现。
type Sessions interface {
	Put(context.Context, string, SessionRecord, time.Duration) error
	Get(context.Context, string) (SessionRecord, bool, error)
	Delete(context.Context, string) error
	Allow(context.Context, string, int, time.Duration) (bool, error)
}

// Passwords 统一密码哈希和恒定时间比较。
type Passwords interface {
	Hash(string) (string, error)
	Verify(string, string) bool
	Token() string
}

// Service 保存认证用例的已注入依赖。
type Service struct {
	repository Repository
	sessions   Sessions
	passwords  Passwords
	ttl        time.Duration
	allowDemo  bool
}

// New 创建身份用例，不在此创建外部连接。
func New(repository Repository, sessions Sessions, passwords Passwords, ttl time.Duration, allowDemo bool) *Service {
	return &Service{repository, sessions, passwords, ttl, allowDemo}
}

// Login 使用邮箱和密码认证，拒绝在错误响应中泄露账户存在性。
func (s *Service) Login(ctx context.Context, email, password, source string) (LoginResult, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	if len(email) > 254 || len(password) == 0 || len(password) > 256 {
		return LoginResult{}, fault.New(fault.Invalid, "邮箱或密码格式不正确")
	}
	allowed, err := s.sessions.Allow(ctx, "login:"+source+":"+email, 10, 15*time.Minute)
	if err != nil {
		return LoginResult{}, err
	}
	if !allowed {
		return LoginResult{}, fault.New(fault.TooMany, "登录尝试过于频繁，请稍后再试")
	}
	account, err := s.repository.ByEmail(ctx, email)
	if err != nil {
		return LoginResult{}, err
	}
	valid := s.passwords.Verify(account.PasswordHash, password)
	if account.View.ID == "" || account.Disabled || !valid {
		return LoginResult{}, fault.New(fault.Unauthenticated, "邮箱或密码不正确")
	}
	return s.login(ctx, account)
}

// DemoLogin 仅在显式启用时登录固定测试号，不允许客户端选择任意用户。
func (s *Service) DemoLogin(ctx context.Context, source string) (LoginResult, error) {
	if !s.allowDemo {
		return LoginResult{}, fault.New(fault.Forbidden, "当前环境未开放演示登录")
	}
	allowed, err := s.sessions.Allow(ctx, "demo:"+source, 20, time.Minute)
	if err != nil {
		return LoginResult{}, err
	}
	if !allowed {
		return LoginResult{}, fault.New(fault.TooMany, "操作过于频繁，请稍后再试")
	}
	account, err := s.repository.ByUUID(ctx, id.Demo("user", "jo"))
	if err != nil {
		return LoginResult{}, err
	}
	if account.View.ID == "" || account.Disabled || !account.View.IsTestAccount || account.TestDataset != "frontend-demo-v1" {
		return LoginResult{}, fault.New(fault.Unavailable, "测试账号尚未导入或已停用")
	}
	return s.login(ctx, account)
}

func (s *Service) login(ctx context.Context, account Account) (LoginResult, error) {
	token, csrf := s.passwords.Token(), s.passwords.Token()
	record := SessionRecord{UserUUID: account.View.ID, AuthVersion: account.AuthVersion, CSRFToken: csrf, ExpiresAt: time.Now().UTC().Add(s.ttl)}
	if err := s.sessions.Put(ctx, token, record, s.ttl); err != nil {
		return LoginResult{}, err
	}
	return LoginResult{View: SessionView{User: account.View, CSRFToken: csrf}, Token: token}, nil
}

// Session 每次校验数据库认证版本和停用状态。
func (s *Service) Session(ctx context.Context, token string) (SessionView, error) {
	record, ok, err := s.sessions.Get(ctx, token)
	if err != nil {
		return SessionView{}, err
	}
	if !ok || record.ExpiresAt.Before(time.Now()) {
		return SessionView{}, fault.New(fault.Unauthenticated, "请先登录")
	}
	account, err := s.repository.ByUUID(ctx, record.UserUUID)
	if err != nil {
		return SessionView{}, err
	}
	if account.View.ID == "" || account.Disabled || account.AuthVersion != record.AuthVersion {
		return SessionView{}, fault.New(fault.Unauthenticated, "会话已失效，请重新登录")
	}
	return SessionView{User: account.View, CSRFToken: record.CSRFToken}, nil
}

// Logout 先验证 CSRF，再删除服务端会话。
func (s *Service) Logout(ctx context.Context, token, csrf string) error {
	current, err := s.Session(ctx, token)
	if err != nil {
		return err
	}
	if subtle.ConstantTimeCompare([]byte(csrf), []byte(current.CSRFToken)) != 1 {
		return fault.New(fault.Forbidden, "请求校验失败，请刷新页面")
	}
	return s.sessions.Delete(ctx, token)
}
