package redisstore

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	bootstrapconfig "github.com/singaurora/exec-graph/backend/internal/bootstrap/config"
	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
)

const keyPrefix = "exec_graph:"

type SessionStore struct {
	client *redis.Client
}

func NewSessionStore(config bootstrapconfig.RedisConfig) (*SessionStore, error) {
	if config.Host == "" {
		return nil, errors.New("Redis host is required")
	}
	client := redis.NewClient(&redis.Options{
		Addr:         fmt.Sprintf("%s:%d", config.Host, config.Port),
		Password:     config.Password,
		DB:           config.Database,
		DialTimeout:  sharedconstants.RedisDialTimeout,
		ReadTimeout:  sharedconstants.RedisDialTimeout,
		WriteTimeout: sharedconstants.RedisDialTimeout,
	})
	ctx, cancel := context.WithTimeout(context.Background(), sharedconstants.RedisPingTimeout)
	defer cancel()
	if err := client.Ping(ctx).Err(); err != nil {
		_ = client.Close()
		return nil, err
	}
	return &SessionStore{client: client}, nil
}

func (store *SessionStore) Close() error {
	return store.client.Close()
}

func (store *SessionStore) Store(ctx context.Context, token string, userID uint64, contents []byte, ttl time.Duration) error {
	if token == "" || userID == 0 || ttl <= 0 {
		return errors.New("invalid Redis session")
	}
	pipe := store.client.TxPipeline()
	pipe.Set(ctx, store.sessionKey(token), contents, ttl)
	pipe.SAdd(ctx, store.userSessionsKey(userID), tokenHash(token))
	pipe.Expire(ctx, store.userSessionsKey(userID), ttl)
	_, err := pipe.Exec(ctx)
	return err
}

func (store *SessionStore) Load(ctx context.Context, token string) ([]byte, bool, error) {
	if token == "" {
		return nil, false, nil
	}
	contents, err := store.client.Get(ctx, store.sessionKey(token)).Bytes()
	if errors.Is(err, redis.Nil) {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, err
	}
	return contents, true, nil
}

func (store *SessionStore) Delete(ctx context.Context, token string, userID uint64) error {
	if token == "" {
		return nil
	}
	pipe := store.client.TxPipeline()
	pipe.Del(ctx, store.sessionKey(token))
	if userID != 0 {
		pipe.SRem(ctx, store.userSessionsKey(userID), tokenHash(token))
	}
	_, err := pipe.Exec(ctx)
	return err
}

func (store *SessionStore) DeleteUserSessions(ctx context.Context, userID uint64) error {
	if userID == 0 {
		return nil
	}
	userSessionsKey := store.userSessionsKey(userID)
	tokenHashes, err := store.client.SMembers(ctx, userSessionsKey).Result()
	if err != nil {
		return err
	}
	keys := make([]string, 0, len(tokenHashes)+1)
	for _, hash := range tokenHashes {
		keys = append(keys, keyPrefix+"session:"+hash)
	}
	keys = append(keys, userSessionsKey)
	return store.client.Del(ctx, keys...).Err()
}

func (store *SessionStore) sessionKey(token string) string {
	return keyPrefix + "session:" + tokenHash(token)
}

func (store *SessionStore) userSessionsKey(userID uint64) string {
	return fmt.Sprintf("%suser-sessions:%d", keyPrefix, userID)
}

func tokenHash(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
