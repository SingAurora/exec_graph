package endpoint

import (
	"errors"
	"net"
	"net/http"
	"strings"

	applicationidentity "github.com/singaurora/exec-graph/backend/internal/application/identity"
)

type emailRequest struct {
	Email   string `json:"email"`
	Purpose string `json:"purpose"`
}
type registerRequest struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Code     string `json:"code"`
}

func (s *Server) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) sendCode(w http.ResponseWriter, r *http.Request) {
	var request emailRequest
	if !bindJSON(w, r, &request) {
		return
	}
	var currentUser *authenticatedUser
	purpose := strings.TrimSpace(request.Purpose)
	if purpose == applicationidentity.PurposeChangeEmail || purpose == applicationidentity.PurposeChangePassword {
		user, ok := s.requireUser(w, r)
		if !ok {
			return
		}
		currentUser = &user
	}
	if err := s.identity.SendCode(r.Context(), applicationidentity.SendCodeInput{Email: request.Email, Purpose: purpose, CurrentUser: currentUser, ClientIP: clientIP(r)}); err != nil {
		writeIdentityError(w, err, "保存验证码失败")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "验证码已发送"})
}

func (s *Server) register(w http.ResponseWriter, r *http.Request) {
	var request registerRequest
	if !bindJSON(w, r, &request) {
		return
	}
	user, token, err := s.identity.Register(r.Context(), applicationidentity.RegisterInput{Username: request.Username, Email: request.Email, Password: request.Password, Code: request.Code})
	if err != nil {
		writeIdentityError(w, err, "创建账号失败")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"accessToken": token, "user": user})
}

func normalizeUserID(value string) (string, error) { return applicationidentity.NormalizeUserID(value) }
func normalizeEmail(value string) (string, error)  { return applicationidentity.NormalizeEmail(value) }

func clientIP(r *http.Request) string {
	address, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return address
}

func writeIdentityError(w http.ResponseWriter, err error, fallback string) {
	switch {
	case errors.Is(err, applicationidentity.ErrUnauthenticated):
		writeError(w, http.StatusUnauthorized, "请先登录")
	case errors.Is(err, applicationidentity.ErrInvalidPurpose):
		writeError(w, http.StatusBadRequest, "验证码用途不正确")
	case errors.Is(err, applicationidentity.ErrInvalidEmail), errors.Is(err, applicationidentity.ErrEmailUnchanged):
		writeError(w, http.StatusBadRequest, "请输入与当前账号不同的有效邮箱")
	case errors.Is(err, applicationidentity.ErrEmailRegistered):
		writeError(w, http.StatusConflict, "该邮箱已经注册")
	case errors.Is(err, applicationidentity.ErrEmailNotFound):
		writeError(w, http.StatusNotFound, "该邮箱尚未注册")
	case errors.Is(err, applicationidentity.ErrInvalidUsername):
		writeError(w, http.StatusBadRequest, "用户名长度需要在 2 到 64 个字符之间")
	case errors.Is(err, applicationidentity.ErrInvalidPassword):
		writeError(w, http.StatusBadRequest, "密码至少需要 6 个字符")
	case errors.Is(err, applicationidentity.ErrInvalidCode):
		writeError(w, http.StatusBadRequest, "验证码错误或格式不正确")
	case errors.Is(err, applicationidentity.ErrInvalidCredentials):
		writeError(w, http.StatusUnauthorized, "邮箱或密码不正确")
	case errors.Is(err, applicationidentity.ErrCurrentPassword):
		writeError(w, http.StatusUnauthorized, "当前密码不正确")
	default:
		writeError(w, http.StatusInternalServerError, fallback)
	}
}
