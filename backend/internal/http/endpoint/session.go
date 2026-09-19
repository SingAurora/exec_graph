package endpoint

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	applicationidentity "github.com/singaurora/exec-graph/backend/internal/application/identity"
	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
)

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}
type authenticatedUser = applicationidentity.User
type authenticatedUserContextKey struct{}

func (s *Server) login(w http.ResponseWriter, r *http.Request) error {
	var request loginRequest
	if err := decodeJSON(r, &request); err != nil {
		return err
	}
	user, token, err := s.identity.Login(r.Context(), applicationidentity.LoginInput{Email: request.Email, Password: request.Password})
	if err != nil {
		return identityFault(err, "登录失败")
	}
	writeJSON(w, http.StatusOK, map[string]any{"accessToken": token, "user": user})
	return nil
}

func (s *Server) logout(w http.ResponseWriter, r *http.Request) error {
	if token := bearerToken(r); token != "" {
		ctx, cancel := context.WithTimeout(r.Context(), sharedconstants.SessionLogoutTimeout)
		defer cancel()
		if err := s.identity.DeleteSession(ctx, token); err != nil {
			return fault.Wrap(fault.DependencyUnavailable, "登录会话暂时不可用，请稍后重试", err)
		}
	}
	writeJSON(w, http.StatusOK, nil)
	return nil
}

func (s *Server) me(w http.ResponseWriter, r *http.Request) error {
	user, err := s.requireUserError(r)
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": user})
	return nil
}

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
	value := strings.TrimSpace(r.Header.Get("Authorization"))
	if len(value) < len("Bearer ") || !strings.EqualFold(value[:len("Bearer ")], "Bearer ") {
		return ""
	}
	return strings.TrimSpace(value[len("Bearer "):])
}
