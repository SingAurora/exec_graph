// Package account 实现邮件验证、注册与账户安全用例。
package account

import (
	"context"
	"time"

	"github.com/singaurora/exec-graph/backend/internal/application/identity"
)

// CodeInput 指定验证码的用途和接收邮箱，不接受客户端验证码或有效期。
type CodeInput struct {
	Purpose string `json:"purpose"`
	Email   string `json:"email"`
}

// RegisterInput 普通注册不接收测试账号或管理员标记。
type RegisterInput struct {
	Email    string `json:"email"`
	Code     string `json:"code"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

// ResetInput 通过绑定邮箱验证码重置密码。
type ResetInput struct {
	Email    string `json:"email"`
	Code     string `json:"code"`
	Password string `json:"password"`
}

// ChangePasswordInput 同时证明当前密码与绑定邮箱所有权。
type ChangePasswordInput struct {
	CurrentPassword string `json:"currentPassword"`
	Password        string `json:"password"`
	Code            string `json:"code"`
}

// ChangeEmailInput 同时证明当前密码与新邮箱所有权。
type ChangeEmailInput struct {
	CurrentPassword string `json:"currentPassword"`
	Email           string `json:"email"`
	Code            string `json:"code"`
}

// Registration 是已完成验证码校验和密码哈希的建号请求。
type Registration struct {
	UUID, Email, PasswordHash, Name string
	VerifiedAt                      time.Time
}

// Repository 持有账户读取与认证版本事务写入能力。
type Repository interface {
	identity.Repository
	Register(context.Context, Registration) error
	ReplacePassword(context.Context, identity.Actor, string, string) error
	ReplaceEmail(context.Context, identity.Actor, string, string) error
}

// Codes 将验证码的写入、重试次数与原子一次性消耗交给 Redis。
type Codes interface {
	Issue(context.Context, string, string, string, time.Duration) error
	Consume(context.Context, string, string, string) (bool, error)
	Revoke(context.Context, string, string) error
	Allow(context.Context, string, int, time.Duration) (bool, error)
}

// Sender 是通过模板发送验证码的外部邮件能力。
type Sender interface {
	SendCode(context.Context, string, string, time.Duration) error
}

// CodeView 返回发送后的有效期和重发间隔，不返回验证码。
type CodeView struct {
	ExpiresIn  int `json:"expiresIn"`
	RetryAfter int `json:"retryAfter"`
}
