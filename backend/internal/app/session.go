package app

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"strings"
	"time"
)

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type authenticatedUser struct {
	ID       uint64 `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
}

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

	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	var user authenticatedUser
	var passwordHash string
	err = s.db.QueryRowContext(ctx, `
		SELECT id, username, email, password_hash
		FROM users WHERE email = ?`, email).Scan(&user.ID, &user.Username, &user.Email, &passwordHash)
	if errors.Is(err, sql.ErrNoRows) || passwordHash != request.Password {
		writeError(w, http.StatusUnauthorized, "邮箱或密码不正确")
		return
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "登录失败")
		return
	}
	defer tx.Rollback()
	token, err := s.createSessionTx(ctx, tx, user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "创建登录会话失败")
		return
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "保存登录会话失败")
		return
	}
	s.cacheSession(r.Context(), token, user)
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
		if _, err := s.db.ExecContext(ctx, `DELETE FROM auth_sessions WHERE token_hash = ?`, hashValue(token)); err != nil {
			writeError(w, http.StatusInternalServerError, "退出登录失败")
			return
		}
		s.deleteCachedSession(ctx, token)
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
		writeError(w, http.StatusUnauthorized, "请先登录")
		return authenticatedUser{}, false
	}
	return user, true
}

func (s *server) authenticate(r *http.Request) (authenticatedUser, error) {
	token := bearerToken(r)
	if token == "" {
		return authenticatedUser{}, errors.New("missing access token")
	}
	if user, ok := s.loadCachedSession(r.Context(), token); ok {
		return user, nil
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	var user authenticatedUser
	err := s.db.QueryRowContext(ctx, `
		SELECT u.id, u.username, u.email
		FROM auth_sessions session
		JOIN users u ON u.id = session.user_id
		WHERE session.token_hash = ? AND session.expires_at > NOW()`, hashValue(token)).Scan(&user.ID, &user.Username, &user.Email)
	if err != nil {
		return authenticatedUser{}, err
	}
	s.cacheSession(r.Context(), token, user)
	return user, nil
}

func (s *server) createSessionTx(ctx context.Context, tx *sql.Tx, userID uint64) (string, error) {
	token, err := newSessionToken()
	if err != nil {
		return "", err
	}
	expiresAt := time.Now().Add(time.Duration(s.config.App.SessionTTLHours) * time.Hour)
	_, err = tx.ExecContext(ctx, `
		INSERT INTO auth_sessions (user_id, token_hash, expires_at)
		VALUES (?, ?, ?)`, userID, hashValue(token), expiresAt)
	if err != nil {
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
