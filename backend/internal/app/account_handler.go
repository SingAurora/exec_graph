package app

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"strings"
	"time"
)

type changeEmailRequest struct {
	Email           string `json:"email"`
	CurrentPassword string `json:"currentPassword"`
	Code            string `json:"code"`
}

type changePasswordRequest struct {
	CurrentPassword string `json:"currentPassword"`
	NextPassword    string `json:"nextPassword"`
	Code            string `json:"code"`
}

type resetPasswordRequest struct {
	Email        string `json:"email"`
	NextPassword string `json:"nextPassword"`
	Code         string `json:"code"`
}

func (s *server) changeEmail(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "不支持的请求方法")
		return
	}
	user, ok := s.requireUser(w, r)
	if !ok {
		return
	}
	var request changeEmailRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "请求格式不正确")
		return
	}
	email, err := normalizeEmail(request.Email)
	if err != nil || email == user.Email {
		writeError(w, http.StatusBadRequest, "请输入与当前账号不同的有效邮箱")
		return
	}
	if strings.TrimSpace(request.CurrentPassword) == "" || !verificationCodePattern.MatchString(request.Code) {
		writeError(w, http.StatusBadRequest, "请输入当前密码和 6 位验证码")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "修改邮箱失败")
		return
	}
	defer tx.Rollback()
	var passwordHash string
	if err := tx.QueryRowContext(ctx, `SELECT password_hash FROM users WHERE id = ?`, user.ID).Scan(&passwordHash); err != nil {
		writeError(w, http.StatusInternalServerError, "读取账号信息失败")
		return
	}
	if passwordHash != request.CurrentPassword {
		writeError(w, http.StatusUnauthorized, "当前密码不正确")
		return
	}
	if err := consumeVerificationCodeTx(ctx, tx, email, verificationPurposeChangeEmail, request.Code); err != nil {
		writeError(w, http.StatusBadRequest, "验证码错误或已过期")
		return
	}
	if _, err := tx.ExecContext(ctx, `UPDATE users SET email = ?, email_verified_at = NOW() WHERE id = ?`, email, user.ID); err != nil {
		if strings.Contains(err.Error(), "Duplicate entry") {
			writeError(w, http.StatusConflict, "该邮箱已经注册")
		} else {
			writeError(w, http.StatusInternalServerError, "保存新邮箱失败")
		}
		return
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "保存新邮箱失败")
		return
	}
	s.cacheSession(r.Context(), bearerToken(r), authenticatedUser{ID: user.ID, Username: user.Username, UserID: user.UserID, Email: email})
	writeJSON(w, http.StatusOK, map[string]any{"user": map[string]any{"id": user.ID, "username": user.Username, "userId": user.UserID, "email": email}})
}

func (s *server) changePassword(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "不支持的请求方法")
		return
	}
	user, ok := s.requireUser(w, r)
	if !ok {
		return
	}
	var request changePasswordRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "请求格式不正确")
		return
	}
	if len(request.NextPassword) < 6 {
		writeError(w, http.StatusBadRequest, "新密码至少需要 6 个字符")
		return
	}
	if strings.TrimSpace(request.CurrentPassword) == "" || !verificationCodePattern.MatchString(request.Code) {
		writeError(w, http.StatusBadRequest, "请输入当前密码和 6 位验证码")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "修改密码失败")
		return
	}
	defer tx.Rollback()
	var passwordHash string
	if err := tx.QueryRowContext(ctx, `SELECT password_hash FROM users WHERE id = ?`, user.ID).Scan(&passwordHash); err != nil {
		writeError(w, http.StatusInternalServerError, "读取账号信息失败")
		return
	}
	if passwordHash != request.CurrentPassword {
		writeError(w, http.StatusUnauthorized, "当前密码不正确")
		return
	}
	if err := consumeVerificationCodeTx(ctx, tx, user.Email, verificationPurposeChangePassword, request.Code); err != nil {
		writeError(w, http.StatusBadRequest, "验证码错误或已过期")
		return
	}
	if _, err := tx.ExecContext(ctx, `UPDATE users SET password_hash = ? WHERE id = ?`, request.NextPassword, user.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "保存新密码失败")
		return
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "保存新密码失败")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "密码已更新"})
}

func (s *server) resetPassword(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "不支持的请求方法")
		return
	}
	var request resetPasswordRequest
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, http.StatusBadRequest, "请求格式不正确")
		return
	}
	email, err := normalizeEmail(request.Email)
	if err != nil {
		writeError(w, http.StatusBadRequest, "请输入有效邮箱")
		return
	}
	if len(request.NextPassword) < 6 || !verificationCodePattern.MatchString(request.Code) {
		writeError(w, http.StatusBadRequest, "请输入至少 6 位的新密码和 6 位验证码")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "重设密码失败")
		return
	}
	defer tx.Rollback()
	var userID uint64
	if err := tx.QueryRowContext(ctx, `SELECT id FROM users WHERE email = ? FOR UPDATE`, email).Scan(&userID); err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "该邮箱尚未注册")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "读取账号信息失败")
		return
	}
	if err := consumeVerificationCodeTx(ctx, tx, email, verificationPurposeResetPassword, request.Code); err != nil {
		writeError(w, http.StatusBadRequest, "验证码错误或已过期")
		return
	}
	if _, err := tx.ExecContext(ctx, `UPDATE users SET password_hash = ? WHERE id = ?`, request.NextPassword, userID); err != nil {
		writeError(w, http.StatusInternalServerError, "保存新密码失败")
		return
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM auth_sessions WHERE user_id = ?`, userID); err != nil {
		writeError(w, http.StatusInternalServerError, "重设登录会话失败")
		return
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "保存新密码失败")
		return
	}
	s.deleteCachedUserSessions(r.Context(), userID)
	writeJSON(w, http.StatusOK, map[string]string{"message": "密码已重设，请使用新密码登录"})
}

func consumeVerificationCodeTx(ctx context.Context, tx *sql.Tx, email, purpose, code string) error {
	var verificationID uint64
	var expectedHash string
	err := tx.QueryRowContext(ctx, `
		SELECT id, code_hash
		FROM email_verification_codes
		WHERE email = ? AND purpose = ? AND used_at IS NULL AND expires_at > NOW()
		ORDER BY id DESC LIMIT 1 FOR UPDATE`, email, purpose).Scan(&verificationID, &expectedHash)
	if errors.Is(err, sql.ErrNoRows) || !equalHash(expectedHash, code) {
		return errors.New("invalid verification code")
	}
	result, err := tx.ExecContext(ctx, `
		UPDATE email_verification_codes SET used_at = NOW()
		WHERE id = ? AND used_at IS NULL`, verificationID)
	if err != nil {
		return err
	}
	count, err := result.RowsAffected()
	if err != nil || count != 1 {
		return errors.New("verification code already used")
	}
	return nil
}
