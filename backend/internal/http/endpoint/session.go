package endpoint

import (
	"context"
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	applicationidentity "github.com/singaurora/exec-graph/backend/internal/application/identity"
	endpointcommon "github.com/singaurora/exec-graph/backend/internal/http/endpoint/common"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
)

type authenticatedUser = applicationidentity.User
type authenticatedUserContextKey struct{}

func (s *Server) requireUserError(r *http.Request) (authenticatedUser, error) {
	if user, ok := userFromContext(r); ok {
		return user, nil
	}
	user, err := s.authenticate(r)
	if err != nil {
		if errors.Is(err, applicationidentity.ErrUnauthenticated) {
			return authenticatedUser{}, fault.New(fault.Unauthenticated, "请先登录")
		}
		return authenticatedUser{}, fault.Wrap(fault.DependencyUnavailable, "登录会话暂时不可用，请稍后重试", err)
	}
	return user, nil
}

func (s *Server) requireUser(w http.ResponseWriter, r *http.Request) (authenticatedUser, bool) {
	user, err := s.requireUserError(r)
	if err != nil {
		writeFault(w, err)
		return authenticatedUser{}, false
	}
	return user, true
}

func (s *Server) authenticationMiddleware() gin.HandlerFunc {
	return func(ginContext *gin.Context) {
		user, err := s.authenticate(ginContext.Request)
		if err != nil {
			if errors.Is(err, applicationidentity.ErrUnauthenticated) {
				_ = ginContext.Error(fault.New(fault.Unauthenticated, "请先登录"))
			} else {
				_ = ginContext.Error(fault.Wrap(fault.DependencyUnavailable, "登录会话暂时不可用，请稍后重试", err))
			}
			ginContext.Abort()
			return
		}
		ginContext.Request = ginContext.Request.WithContext(context.WithValue(ginContext.Request.Context(), authenticatedUserContextKey{}, user))
		ginContext.Next()
	}
}

func userFromContext(r *http.Request) (authenticatedUser, bool) {
	user, ok := r.Context().Value(authenticatedUserContextKey{}).(authenticatedUser)
	return user, ok
}
func (s *Server) optionalUser(r *http.Request) (authenticatedUser, bool) {
	if bearerToken(r) == "" {
		return authenticatedUser{}, false
	}
	user, err := s.authenticate(r)
	return user, err == nil
}
func (s *Server) authenticate(r *http.Request) (authenticatedUser, error) {
	return s.identity.Authenticate(r.Context(), bearerToken(r))
}
func bearerToken(r *http.Request) string {
	return endpointcommon.BearerToken(r)
}
