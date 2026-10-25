// Package security 实现平台密码与随机令牌，不存储明文密码。
package security

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"fmt"
	"strings"

	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
	"golang.org/x/crypto/argon2"
)

// Passwords 是 Argon2id 密码哈希和随机令牌适配器。
type Passwords struct{}

// Hash 为每个密码生成独立随机盐。
func (Passwords) Hash(password string) (string, error) {
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	hash := argon2.IDKey([]byte(password), salt, constants.PasswordIterations, constants.PasswordMemoryKiB, constants.PasswordParallelism, 32)
	return fmt.Sprintf("$argon2id$v=19$m=%d,t=%d,p=%d$%s$%s", constants.PasswordMemoryKiB, constants.PasswordIterations, constants.PasswordParallelism, base64.RawStdEncoding.EncodeToString(salt), base64.RawStdEncoding.EncodeToString(hash)), nil
}

// Verify 只接受本版本受控成本参数；不存在的账户也执行一次哈希计算。
func (p Passwords) Verify(encoded, password string) bool {
	prefix := fmt.Sprintf("$argon2id$v=19$m=%d,t=%d,p=%d$", constants.PasswordMemoryKiB, constants.PasswordIterations, constants.PasswordParallelism)
	parts := strings.Split(strings.TrimPrefix(encoded, prefix), "$")
	salt, hash := []byte("invalid-salt-0000"), make([]byte, 32)
	valid := strings.HasPrefix(encoded, prefix) && len(parts) == 2
	if valid {
		var err error
		salt, err = base64.RawStdEncoding.DecodeString(parts[0])
		valid = err == nil && len(salt) == 16
		hash, err = base64.RawStdEncoding.DecodeString(parts[1])
		valid = valid && err == nil && len(hash) == 32
	}
	candidate := argon2.IDKey([]byte(password), salt, constants.PasswordIterations, constants.PasswordMemoryKiB, constants.PasswordParallelism, 32)
	return subtle.ConstantTimeCompare(candidate, hash) == 1 && valid
}

// Token 生成 256 位不可预测令牌。
func (Passwords) Token() string {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		panic("系统随机数不可用")
	}
	return base64.RawURLEncoding.EncodeToString(bytes)
}
