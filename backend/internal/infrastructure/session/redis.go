// Package session 实现具有独立键空间的 Redis 会话。
package session

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net"
	"strconv"

	"github.com/redis/go-redis/v9"
	"github.com/singaurora/exec-graph/backend/internal/bootstrap/config"
	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
)

// Store 是应用拥有的 Redis 客户端及隔离前缀。
type Store struct {
	client *redis.Client
	prefix string
}

// Open 建立真实 Redis 连接，不使用进程内存回退。
func Open(ctx context.Context, c config.Redis) (*Store, error) {
	client := redis.NewClient(&redis.Options{Addr: net.JoinHostPort(c.Host, strconv.Itoa(c.Port)), Password: c.Password, DB: c.Database, DialTimeout: constants.DependencyTimeout, ReadTimeout: constants.DependencyTimeout, WriteTimeout: constants.DependencyTimeout, MaxRetries: 0})
	if err := client.Ping(ctx).Err(); err != nil {
		_ = client.Close()
		return nil, fmt.Errorf("连接 Redis 失败: %w", err)
	}
	return &Store{client: client, prefix: c.Prefix}, nil
}

// Close 关闭连接，不清除其他会话或旧项目数据。
func (s *Store) Close() error { return s.client.Close() }

// Ping 用于依赖就绪检查。
func (s *Store) Ping(ctx context.Context) error { return s.client.Ping(ctx).Err() }

func (s *Store) key(token string) string {
	sum := sha256.Sum256([]byte(token))
	return s.prefix + "session:" + hex.EncodeToString(sum[:])
}
