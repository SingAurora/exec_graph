package app

import (
	"context"
	"encoding/json"
	"time"
)

func (s *server) cacheSession(ctx context.Context, token string, user authenticatedUser) {
	if s.redis == nil || token == "" {
		return
	}
	contents, err := json.Marshal(user)
	if err != nil {
		return
	}
	ttl := time.Duration(s.config.App.SessionTTLHours) * time.Hour
	s.redis.Store(ctx, token, user.ID, contents, ttl)
}

func (s *server) loadCachedSession(ctx context.Context, token string) (authenticatedUser, bool) {
	if s.redis == nil || token == "" {
		return authenticatedUser{}, false
	}
	contents, ok := s.redis.Load(ctx, token)
	if !ok {
		return authenticatedUser{}, false
	}
	var user authenticatedUser
	if err := json.Unmarshal(contents, &user); err != nil || user.ID == 0 {
		s.redis.Delete(ctx, token, 0)
		return authenticatedUser{}, false
	}
	return user, true
}

func (s *server) deleteCachedSession(ctx context.Context, token string) {
	if s.redis == nil || token == "" {
		return
	}
	userID := uint64(0)
	if contents, ok := s.redis.Load(ctx, token); ok {
		var user authenticatedUser
		if json.Unmarshal(contents, &user) == nil {
			userID = user.ID
		}
	}
	s.redis.Delete(ctx, token, userID)
}

func (s *server) deleteCachedUserSessions(ctx context.Context, userID uint64) {
	if s.redis != nil {
		s.redis.DeleteUserSessions(ctx, userID)
	}
}
