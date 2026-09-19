package endpoint

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	applicationidentity "github.com/singaurora/exec-graph/backend/internal/application/identity"
	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
)

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}
type authenticatedUser = applicationidentity.User
type authenticatedUserContextKey struct{}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var request loginRequest
	if !bindJSON(w, r, &request) {
		return
	}
	user, token, err := s.identity.Login(r.Context(), applicationidentity.LoginInput{Email: request.Email, Password: request.Password})
	if err != nil {
		writeIdentityError(w, err, "登录失败")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"accessToken": token, "user": user})
}

func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	if token := bearerToken(r); token != "" {
		ctx, cancel := context.WithTimeout(r.Context(), sharedconstants.SessionLogoutTimeout)
		defer cancel()
		if err := s.identity.DeleteSession(ctx, token); err != nil {
			writeError(w, http.StatusServiceUnavailable, "退出 Redis 登录会话失败，请稍后重试")
			return
		}
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) me(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requireUser(w, r)
	if ok {
		writeJSON(w, http.StatusOK, map[string]any{"user": user})
	}
}

func (s *Server) requireUser(w http.ResponseWriter, r *http.Request) (authenticatedUser, bool) {
	if user, ok := userFromContext(r); ok {
		return user, true
	}
	user, err := s.authenticate(r)
	if err != nil {
		if errors.Is(err, applicationidentity.ErrUnauthenticated) {
			writeError(w, http.StatusUnauthorized, "请先登录")
		} else {
			writeError(w, http.StatusServiceUnavailable, "Redis 登录会话暂时不可用，请稍后重试")
		}
		return authenticatedUser{}, false
	}
	return user, true
}

func (s *Server) authenticationMiddleware() gin.HandlerFunc {
	return func(ginContext *gin.Context) {
		user, err := s.authenticate(ginContext.Request)
		if err != nil {
			if errors.Is(err, applicationidentity.ErrUnauthenticated) {
				writeError(ginContext.Writer, http.StatusUnauthorized, "请先登录")
			} else {
				writeError(ginContext.Writer, http.StatusServiceUnavailable, "Redis 登录会话暂时不可用，请稍后重试")
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
