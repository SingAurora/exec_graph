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

	ctx, cancel := context.WithTimeout(r.Context(), sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	repository := infrastructuremysql.NewIdentityRepository(s.orm)
	err = repository.Transaction(ctx, func(tx infrastructuremysql.IdentityRepository) error {
		stored, err := tx.FindUserByID(ctx, user.ID)
		if err != nil {
			return err
		}
		if stored.PasswordHash != request.CurrentPassword {
			return errCurrentPasswordIncorrect
		}
		if err := consumeVerificationCode(ctx, tx, email, verificationPurposeChangeEmail, request.Code); err != nil {
			return err
		}
		now := time.Now()
		return tx.UpdateUser(ctx, user.ID, map[string]any{"email": email, "email_verified_at": now})
	})
	if err != nil {
		if errors.Is(err, errCurrentPasswordIncorrect) {
			writeError(w, http.StatusUnauthorized, "当前密码不正确")
		} else if errors.Is(err, errInvalidVerificationCode) {
			writeError(w, http.StatusBadRequest, "验证码错误或已过期")
		} else if strings.Contains(err.Error(), "Duplicate entry") {
			writeError(w, http.StatusConflict, "该邮箱已经注册")
		} else {
			writeError(w, http.StatusInternalServerError, "保存新邮箱失败")
		}
		return
	}
	if err := s.cacheSession(r.Context(), bearerToken(r), authenticatedUser{ID: user.ID, Username: user.Username, UserID: user.UserID, Email: email}); err != nil {
		writeError(w, http.StatusServiceUnavailable, "邮箱已更新，但 Redis 登录会话暂时不可用，请稍后重试")
		return
	}
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

	ctx, cancel := context.WithTimeout(r.Context(), sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	repository := infrastructuremysql.NewIdentityRepository(s.orm)
	err := repository.Transaction(ctx, func(tx infrastructuremysql.IdentityRepository) error {
		stored, err := tx.FindUserByID(ctx, user.ID)
		if err != nil {
			return err
		}
		if stored.PasswordHash != request.CurrentPassword {
			return errCurrentPasswordIncorrect
		}
		if err := consumeVerificationCode(ctx, tx, user.Email, verificationPurposeChangePassword, request.Code); err != nil {
			return err
		}
		return tx.UpdateUser(ctx, user.ID, map[string]any{"password_hash": request.NextPassword})
	})
	if err != nil {
		if errors.Is(err, errCurrentPasswordIncorrect) {
			writeError(w, http.StatusUnauthorized, "当前密码不正确")
		} else if errors.Is(err, errInvalidVerificationCode) {
			writeError(w, http.StatusBadRequest, "验证码错误或已过期")
		} else {
			writeError(w, http.StatusInternalServerError, "保存新密码失败")
		}
		return
	}
	if err := s.deleteCachedUserSessions(r.Context(), user.ID); err != nil {
		writeError(w, http.StatusServiceUnavailable, "密码已更新，但 Redis 会话撤销失败，请稍后重试")
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

	ctx, cancel := context.WithTimeout(r.Context(), sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	var userID uint64
	repository := infrastructuremysql.NewIdentityRepository(s.orm)
	err = repository.Transaction(ctx, func(tx infrastructuremysql.IdentityRepository) error {
		stored, err := tx.FindUserByEmail(ctx, email, true)
		if err != nil {
			return err
		}
		userID = stored.ID
		if err := consumeVerificationCode(ctx, tx, email, verificationPurposeResetPassword, request.Code); err != nil {
			return err
		}
		if err := tx.UpdateUser(ctx, userID, map[string]any{"password_hash": request.NextPassword}); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		if errors.Is(err, infrastructuremysql.ErrNotFound) {
			writeError(w, http.StatusNotFound, "该邮箱尚未注册")
		} else if errors.Is(err, errInvalidVerificationCode) {
			writeError(w, http.StatusBadRequest, "验证码错误或已过期")
		} else {
			writeError(w, http.StatusInternalServerError, "保存新密码失败")
		}
		return
	}
	if err := s.deleteCachedUserSessions(r.Context(), userID); err != nil {
		writeError(w, http.StatusServiceUnavailable, "密码已重设，但 Redis 会话撤销失败，请稍后重试")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "密码已重设，请使用新密码登录"})
}

var (
	errInvalidVerificationCode  = errors.New("invalid verification code")
	errCurrentPasswordIncorrect = errors.New("current password incorrect")
)

func consumeVerificationCode(ctx context.Context, repository infrastructuremysql.IdentityRepository, email, purpose, code string) error {
	verification, err := repository.LatestActiveCode(ctx, email, purpose, true)
	if errors.Is(err, infrastructuremysql.ErrNotFound) || !equalHash(verification.CodeHash, code) {
		return errInvalidVerificationCode
	}
	if err != nil {
		return err
	}
	used, err := repository.MarkCodeUsed(ctx, verification.ID)
	if err != nil {
		return err
	}
	if !used {
		return errInvalidVerificationCode
	}
	return nil
}
