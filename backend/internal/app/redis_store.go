package app

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

const redisKeyPrefix = "exec_graph:"

type RedisStore struct {
	client *redis.Client
}

func newRedisStore(config RedisConfig) (*RedisStore, error) {
	if config.Host == "" {
		return nil, nil
	}
	client := redis.NewClient(&redis.Options{
		Addr:         fmt.Sprintf("%s:%d", config.Host, config.Port),
		Password:     config.Password,
		DB:           config.Database,
		DialTimeout:  2 * time.Second,
		ReadTimeout:  2 * time.Second,
		WriteTimeout: 2 * time.Second,
	})
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := client.Ping(ctx).Err(); err != nil {
		_ = client.Close()
		return nil, err
	}
	return &RedisStore{client: client}, nil
}

func (store *RedisStore) close() error {
	return store.client.Close()
}

func (store *RedisStore) sessionKey(token string) string {
	return redisKeyPrefix + "session:" + hashValue(token)
}

func (store *RedisStore) userSessionsKey(userID uint64) string {
	return fmt.Sprintf("%suser-sessions:%d", redisKeyPrefix, userID)
}

func (s *server) cacheSession(ctx context.Context, token string, user authenticatedUser) {
	if s.redis == nil || token == "" {
		return
	}
	contents, err := json.Marshal(user)
	if err != nil {
		return
	}
	ttl := time.Duration(s.config.App.SessionTTLHours) * time.Hour
	if ttl <= 0 {
		return
	}
	pipe := s.redis.client.TxPipeline()
	pipe.Set(ctx, s.redis.sessionKey(token), contents, ttl)
	pipe.SAdd(ctx, s.redis.userSessionsKey(user.ID), hashValue(token))
	pipe.Expire(ctx, s.redis.userSessionsKey(user.ID), ttl)
	_, _ = pipe.Exec(ctx)
}

func (s *server) loadCachedSession(ctx context.Context, token string) (authenticatedUser, bool) {
	if s.redis == nil || token == "" {
		return authenticatedUser{}, false
	}
	contents, err := s.redis.client.Get(ctx, s.redis.sessionKey(token)).Bytes()
	if err != nil {
		return authenticatedUser{}, false
	}
	var user authenticatedUser
	if err := json.Unmarshal(contents, &user); err != nil || user.ID == 0 {
		s.deleteCachedSession(ctx, token)
		return authenticatedUser{}, false
	}
	return user, true
}

func (s *server) deleteCachedSession(ctx context.Context, token string) {
	if s.redis == nil || token == "" {
		return
	}
	sessionKey := s.redis.sessionKey(token)
	contents, err := s.redis.client.Get(ctx, sessionKey).Bytes()
	pipe := s.redis.client.TxPipeline()
	pipe.Del(ctx, sessionKey)
	if err == nil {
		var user authenticatedUser
		if json.Unmarshal(contents, &user) == nil && user.ID != 0 {
			pipe.SRem(ctx, s.redis.userSessionsKey(user.ID), hashValue(token))
		}
	}
	_, _ = pipe.Exec(ctx)
}

func (s *server) deleteCachedUserSessions(ctx context.Context, userID uint64) {
	if s.redis == nil {
		return
	}
	userSessionsKey := s.redis.userSessionsKey(userID)
	tokenHashes, err := s.redis.client.SMembers(ctx, userSessionsKey).Result()
	if err != nil {
		return
	}
	keys := make([]string, 0, len(tokenHashes)+1)
	for _, tokenHash := range tokenHashes {
		keys = append(keys, redisKeyPrefix+"session:"+tokenHash)
	}
	keys = append(keys, userSessionsKey)
	_ = s.redis.client.Del(ctx, keys...).Err()
}
