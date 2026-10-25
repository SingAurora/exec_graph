package session

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/singaurora/exec-graph/backend/internal/application/identity"
)

// Put 存储会话，Redis 键只包含令牌摘要。
func (s *Store) Put(ctx context.Context, token string, record identity.SessionRecord, ttl time.Duration) error {
	body, err := json.Marshal(record)
	if err != nil {
		return err
	}
	if err := s.client.Set(ctx, s.key(token), body, ttl).Err(); err != nil {
		return fmt.Errorf("保存会话: %w", err)
	}
	return nil
}

// Get 读取会话，Redis 不可用时不回退进程内存。
func (s *Store) Get(ctx context.Context, token string) (identity.SessionRecord, bool, error) {
	if len(token) != 43 {
		return identity.SessionRecord{}, false, nil
	}
	body, err := s.client.Get(ctx, s.key(token)).Bytes()
	if errors.Is(err, redis.Nil) {
		return identity.SessionRecord{}, false, nil
	}
	if err != nil {
		return identity.SessionRecord{}, false, fmt.Errorf("读取会话: %w", err)
	}
	var record identity.SessionRecord
	if err := json.Unmarshal(body, &record); err != nil {
		return record, false, fmt.Errorf("会话结构损坏: %w", err)
	}
	return record, true, nil
}

// Delete 只撤销指定会话，不清空整个 Redis。
func (s *Store) Delete(ctx context.Context, token string) error {
	if err := s.client.Del(ctx, s.key(token)).Err(); err != nil {
		return fmt.Errorf("撤销会话: %w", err)
	}
	return nil
}

var limitScript = redis.NewScript(`local count=redis.call('INCR',KEYS[1]); if count==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]) end; return count`)

// Allow 原子维护有 TTL 的尝试计数，key 不保存邮箱或客户端地址原文。
func (s *Store) Allow(ctx context.Context, scope string, max int, ttl time.Duration) (bool, error) {
	sum := sha256.Sum256([]byte(scope))
	n, err := limitScript.Run(ctx, s.client, []string{s.prefix + "limit:" + hex.EncodeToString(sum[:])}, ttl.Milliseconds()).Int()
	if err != nil {
		return false, fmt.Errorf("登录限流: %w", err)
	}
	return n <= max, nil
}
