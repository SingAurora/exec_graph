package app

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	infrastructuremysql "github.com/singaurora/exec-graph/backend/internal/infrastructure/mysql"
	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
)

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type authenticatedUser struct {
	ID       uint64 `json:"id"`
	Username string `json:"username"`
	UserID   string `json:"userId"`
	Email    string `json:"email"`
}

var errUnauthenticated = errors.New("unauthenticated")

func (s *server) login(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "不支持的请求方法")
		return
	}
	var request loginRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "请求格式不正确")
		return
	}
	email, err := normalizeEmail(request.Email)
	if err != nil || strings.TrimSpace(request.Password) == "" {
		writeError(w, http.StatusUnauthorized, "邮箱或密码不正确")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	stored, err := infrastructuremysql.NewIdentityRepository(s.orm).FindUserByEmail(ctx, email, false)
	if errors.Is(err, infrastructuremysql.ErrNotFound) || stored.PasswordHash != request.Password {
		writeError(w, http.StatusUnauthorized, "邮箱或密码不正确")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "登录失败")
		return
	}
	user := authenticatedUser{ID: stored.ID, Username: stored.Username, UserID: stored.UserID, Email: stored.Email}
	token, err := s.createSession(ctx, user)
	if err != nil {
		writeError(w, http.StatusServiceUnavailable, "创建 Redis 登录会话失败，请稍后重试")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"accessToken": token, "user": user})
}

func (s *server) logout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "不支持的请求方法")
		return
	}
	token := bearerToken(r)
	if token != "" {
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()
		if err := s.deleteCachedSession(ctx, token); err != nil {
			writeError(w, http.StatusServiceUnavailable, "退出 Redis 登录会话失败，请稍后重试")
			return
		}
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *server) me(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "不支持的请求方法")
		return
	}
	user, ok := s.requireUser(w, r)
	if !ok {
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": user})
}

func (s *server) requireUser(w http.ResponseWriter, r *http.Request) (authenticatedUser, bool) {
	user, err := s.authenticate(r)
	if err != nil {
		if errors.Is(err, errUnauthenticated) {
			writeError(w, http.StatusUnauthorized, "请先登录")
		} else {
			writeError(w, http.StatusServiceUnavailable, "Redis 登录会话暂时不可用，请稍后重试")
		}
		return authenticatedUser{}, false
	}
	return user, true
}

// optionalUser preserves anonymous access to public read endpoints. Invalid or
// expired tokens are treated as anonymous because the requested resource is
// already public; callers still cannot use this for a protected operation.
func (s *server) optionalUser(r *http.Request) (authenticatedUser, bool) {
	if bearerToken(r) == "" {
		return authenticatedUser{}, false
	}
	user, err := s.authenticate(r)
	if err != nil {
		return authenticatedUser{}, false
	}
	return user, true
}

func (s *server) authenticate(r *http.Request) (authenticatedUser, error) {
	token := bearerToken(r)
	if token == "" {
		return authenticatedUser{}, errUnauthenticated
	}
	user, ok, err := s.loadCachedSession(r.Context(), token)
	if err != nil {
		return authenticatedUser{}, err
	}
	if ok {
		return user, nil
	}
	return authenticatedUser{}, errUnauthenticated
}

func (s *server) createSession(ctx context.Context, user authenticatedUser) (string, error) {
	token, err := newSessionToken()
	if err != nil {
		return "", err
	}
	if err := s.cacheSession(ctx, token, user); err != nil {
		return "", err
	}
	return token, nil
}

func bearerToken(r *http.Request) string {
	value := strings.TrimSpace(r.Header.Get("Authorization"))
	if len(value) < len("Bearer ") || !strings.EqualFold(value[:len("Bearer ")], "Bearer ") {
		return ""
	}
	return strings.TrimSpace(value[len("Bearer "):])
}
