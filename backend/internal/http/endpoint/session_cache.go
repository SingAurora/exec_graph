package endpoint

import "context"

func (s *Server) cacheSession(ctx context.Context, token string, user authenticatedUser) error {
	return s.identity.CacheSession(ctx, token, user)
}
