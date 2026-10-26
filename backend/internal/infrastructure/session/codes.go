package session

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
)

func (s *Store) codeKey(scope, email string) string {
	digest := sha256.Sum256([]byte(scope + "\x00" + email))
	return s.prefix + "verification:" + hex.EncodeToString(digest[:])
}

func codeDigest(scope, email, code string) string {
	digest := sha256.Sum256([]byte(scope + "\x00" + email + "\x00" + code))
	return hex.EncodeToString(digest[:])
}

var issueCode = redis.NewScript(`
redis.call('HSET', KEYS[1], 'digest', ARGV[1], 'attempts', 0)
redis.call('PEXPIRE', KEYS[1], ARGV[2])
return 1
`)

var consumeCode = redis.NewScript(`
local digest = redis.call('HGET', KEYS[1], 'digest')
if not digest then return 0 end
local attempts = redis.call('HINCRBY', KEYS[1], 'attempts', 1)
if digest == ARGV[1] then
  redis.call('DEL', KEYS[1])
  return 1
end
if attempts >= tonumber(ARGV[2]) then redis.call('DEL', KEYS[1]) end
return 0
`)

// Issue 只保存绑定用途和邮箱的验证码摘要与次数，明文只用于发送邮件。
func (s *Store) Issue(ctx context.Context, scope, email, code string, ttl time.Duration) error {
	return issueCode.Run(ctx, s.client, []string{s.codeKey(scope, email)}, codeDigest(scope, email, code), ttl.Milliseconds()).Err()
}

// Consume 原子核验并消耗，避免并发注册或重置重复使用同一验证码。
func (s *Store) Consume(ctx context.Context, scope, email, code string) (bool, error) {
	result, err := consumeCode.Run(ctx, s.client, []string{s.codeKey(scope, email)}, codeDigest(scope, email, code), constants.CodeAttemptLimit).Int()
	return result == 1, err
}

// Revoke 邮件发送失败时撤销本次未送达验证码。
func (s *Store) Revoke(ctx context.Context, scope, email string) error {
	return s.client.Del(ctx, s.codeKey(scope, email)).Err()
}
