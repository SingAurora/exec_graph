package endpoint

import (
	"net/http"

	applicationidentity "github.com/singaurora/exec-graph/backend/internal/application/identity"
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

func (s *Server) changeEmail(w http.ResponseWriter, r *http.Request) error {
	user, err := s.requireUserError(r)
	if err != nil {
		return err
	}
	var request changeEmailRequest
	if err := decodeJSON(r, &request); err != nil {
		return err
	}
	updated, err := s.identity.ChangeEmail(r.Context(), applicationidentity.ChangeEmailInput{User: user, Email: request.Email, CurrentPassword: request.CurrentPassword, Code: request.Code, Token: bearerToken(r)})
	if err != nil {
		return identityFault(err, "保存新邮箱失败")
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": updated})
	return nil
}

func (s *Server) changePassword(w http.ResponseWriter, r *http.Request) error {
	user, err := s.requireUserError(r)
	if err != nil {
		return err
	}
	var request changePasswordRequest
	if err := decodeJSON(r, &request); err != nil {
		return err
	}
	if err := s.identity.ChangePassword(r.Context(), applicationidentity.ChangePasswordInput{User: user, CurrentPassword: request.CurrentPassword, NextPassword: request.NextPassword, Code: request.Code}); err != nil {
		return identityFault(err, "保存新密码失败")
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "密码已更新"})
	return nil
}

func (s *Server) resetPassword(w http.ResponseWriter, r *http.Request) error {
	var request resetPasswordRequest
	if err := decodeJSON(r, &request); err != nil {
		return err
	}
	if err := s.identity.ResetPassword(r.Context(), applicationidentity.ResetPasswordInput{Email: request.Email, NextPassword: request.NextPassword, Code: request.Code}); err != nil {
		return identityFault(err, "保存新密码失败")
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "密码已重设，请使用新密码登录"})
	return nil
}
