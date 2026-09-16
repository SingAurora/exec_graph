package app

import (
	"context"
	"encoding/json"
	"errors"
	"time"
)

func (s *server) cacheSession(ctx context.Context, token string, user authenticatedUser) error {
	if token == "" {
		return errors.New("missing session token")
	}
	contents, err := json.Marshal(user)
	if err != nil {
		return err
	}
	ttl := time.Duration(s.config.App.SessionTTLHours) * time.Hour
	return s.redis.Store(ctx, token, user.ID, contents, ttl)
}

func (s *server) loadCachedSession(ctx context.Context, token string) (authenticatedUser, bool, error) {
	if token == "" {
		return authenticatedUser{}, false, nil
	}
	contents, ok, err := s.redis.Load(ctx, token)
	if err != nil {
		return authenticatedUser{}, false, err
	}
	if !ok {
		return authenticatedUser{}, false, nil
	}
	var user authenticatedUser
	if err := json.Unmarshal(contents, &user); err != nil || user.ID == 0 {
		_ = s.redis.Delete(ctx, token, 0)
		return authenticatedUser{}, false, nil
	}
	return user, true, nil
}

func (s *server) deleteCachedSession(ctx context.Context, token string) error {
	if token == "" {
		return nil
	}
	userID := uint64(0)
	if contents, ok, err := s.redis.Load(ctx, token); err != nil {
		return err
	} else if ok {
		var user authenticatedUser
		if json.Unmarshal(contents, &user) == nil {
			userID = user.ID
		}
	}
	return s.redis.Delete(ctx, token, userID)
}

func (s *server) deleteCachedUserSessions(ctx context.Context, userID uint64) error {
	return s.redis.DeleteUserSessions(ctx, userID)
}
