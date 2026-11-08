// Package security 实现 demo 密码存储与随机令牌。当前版本直接保存明文，仅用于未上线演示。
package security

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
)

// Passwords 是 demo 明文密码和随机令牌适配器。
type Passwords struct{}

// Encode 保存明文密码；仅限未上线演示使用。
func (Passwords) Encode(password string) (string, error) { return password, nil }

// Verify 使用恒定时间比较明文密码。
func (Passwords) Verify(stored, password string) bool {
	return subtle.ConstantTimeCompare([]byte(stored), []byte(password)) == 1
}

// Token 生成 256 位不可预测令牌。
func (Passwords) Token() string {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		panic("系统随机数不可用")
	}
	return base64.RawURLEncoding.EncodeToString(bytes)
}
