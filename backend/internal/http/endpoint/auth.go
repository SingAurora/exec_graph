package endpoint

import (
	"errors"
	"net"
	"net/http"
	"strings"

	applicationidentity "github.com/singaurora/exec-graph/backend/internal/application/identity"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
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

func (s *Server) health(w http.ResponseWriter, _ *http.Request) error {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	return nil
}

func (s *Server) sendCode(w http.ResponseWriter, r *http.Request) error {
	var request emailRequest
	if err := decodeJSON(r, &request); err != nil {
		return err
	}
	var currentUser *authenticatedUser
	purpose := strings.TrimSpace(request.Purpose)
	if purpose == applicationidentity.PurposeChangeEmail || purpose == applicationidentity.PurposeChangePassword {
		user, err := s.requireUserError(r)
		if err != nil {
			return err
		}
		currentUser = &user
	}
	if err := s.identity.SendCode(r.Context(), applicationidentity.SendCodeInput{Email: request.Email, Purpose: purpose, CurrentUser: currentUser, ClientIP: clientIP(r)}); err != nil {
		return identityFault(err, "保存验证码失败")
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "验证码已发送"})
	return nil
}

func (s *Server) register(w http.ResponseWriter, r *http.Request) error {
	var request registerRequest
	if err := decodeJSON(r, &request); err != nil {
		return err
	}
	user, token, err := s.identity.Register(r.Context(), applicationidentity.RegisterInput{Username: request.Username, Email: request.Email, Password: request.Password, Code: request.Code})
	if err != nil {
		return identityFault(err, "创建账号失败")
	}
	writeJSON(w, http.StatusCreated, map[string]any{"accessToken": token, "user": user})
	return nil
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
	writeFault(w, identityFault(err, fallback))
}

func identityFault(err error, fallback string) error {
	switch {
	case errors.Is(err, applicationidentity.ErrUnauthenticated):
		return fault.New(fault.Unauthenticated, "请先登录")
	case errors.Is(err, applicationidentity.ErrInvalidPurpose):
		return fault.New(fault.InvalidRequest, "验证码用途不正确")
	case errors.Is(err, applicationidentity.ErrInvalidEmail), errors.Is(err, applicationidentity.ErrEmailUnchanged):
		return fault.New(fault.InvalidRequest, "请输入与当前账号不同的有效邮箱")
	case errors.Is(err, applicationidentity.ErrEmailRegistered):
		return fault.New(fault.Conflict, "该邮箱已经注册")
	case errors.Is(err, applicationidentity.ErrEmailNotFound):
		return fault.New(fault.NotFound, "该邮箱尚未注册")
	case errors.Is(err, applicationidentity.ErrInvalidUsername):
		return fault.New(fault.InvalidRequest, "用户名长度需要在 2 到 64 个字符之间")
	case errors.Is(err, applicationidentity.ErrInvalidPassword):
		return fault.New(fault.InvalidRequest, "密码至少需要 6 个字符")
	case errors.Is(err, applicationidentity.ErrInvalidCode):
		return fault.New(fault.InvalidRequest, "验证码错误或格式不正确")
	case errors.Is(err, applicationidentity.ErrInvalidCredentials):
		return fault.New(fault.Unauthenticated, "邮箱或密码不正确")
	case errors.Is(err, applicationidentity.ErrCurrentPassword):
		return fault.New(fault.Unauthenticated, "当前密码不正确")
	default:
		return fault.Wrap(fault.Internal, fallback, err)
	}
}
