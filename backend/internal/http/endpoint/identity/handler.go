package identity

import (
	"context"
	"errors"
	"net/http"
	"strings"

	applicationidentity "github.com/singaurora/exec-graph/backend/internal/application/identity"
	endpointcommon "github.com/singaurora/exec-graph/backend/internal/http/endpoint/common"
	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
)

type CurrentUserFunc func(*http.Request) (applicationidentity.User, error)

// Handler 负责身份认证、登录会话和账户凭据相关接口。
type Handler struct {
	service     *applicationidentity.Service
	currentUser CurrentUserFunc
}

func New(service *applicationidentity.Service, currentUser CurrentUserFunc) *Handler {
	return &Handler{service: service, currentUser: currentUser}
}

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

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

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

func (h *Handler) Health(w http.ResponseWriter, _ *http.Request) error {
	endpointcommon.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	return nil
}

// SendVerificationCode 发送注册、改邮箱、改密码或重置密码所需的验证码。
func (h *Handler) SendVerificationCode(w http.ResponseWriter, r *http.Request) error {
	var request emailRequest
	if err := decodeJSON(r, &request); err != nil {
		return err
	}
	var currentUser *applicationidentity.User
	purpose := strings.TrimSpace(request.Purpose)
	if purpose == applicationidentity.PurposeChangeEmail || purpose == applicationidentity.PurposeChangePassword {
		user, err := h.currentUser(r)
		if err != nil {
			return err
		}
		currentUser = &user
	}
	if err := h.service.SendCode(r.Context(), applicationidentity.SendCodeInput{Email: request.Email, Purpose: purpose, CurrentUser: currentUser, ClientIP: endpointcommon.ClientIP(r)}); err != nil {
		return identityFault(err, "保存验证码失败")
	}
	endpointcommon.WriteJSON(w, http.StatusOK, map[string]string{"message": "验证码已发送"})
	return nil
}

// RegisterAccount 使用邮箱验证码创建账号和登录会话。
func (h *Handler) RegisterAccount(w http.ResponseWriter, r *http.Request) error {
	var request registerRequest
	if err := decodeJSON(r, &request); err != nil {
		return err
	}
	user, token, err := h.service.Register(r.Context(), applicationidentity.RegisterInput{Username: request.Username, Email: request.Email, Password: request.Password, Code: request.Code})
	if err != nil {
		return identityFault(err, "创建账号失败")
	}
	endpointcommon.WriteJSON(w, http.StatusCreated, map[string]any{"accessToken": token, "user": user})
	return nil
}

// LoginWithPassword 校验邮箱和密码并创建登录会话。
func (h *Handler) LoginWithPassword(w http.ResponseWriter, r *http.Request) error {
	var request loginRequest
	if err := decodeJSON(r, &request); err != nil {
		return err
	}
	user, token, err := h.service.Login(r.Context(), applicationidentity.LoginInput{Email: request.Email, Password: request.Password})
	if err != nil {
		return identityFault(err, "登录失败")
	}
	endpointcommon.WriteJSON(w, http.StatusOK, map[string]any{"accessToken": token, "user": user})
	return nil
}

// LogoutCurrentSession 销毁当前访问令牌对应的登录会话。
func (h *Handler) LogoutCurrentSession(w http.ResponseWriter, r *http.Request) error {
	if token := endpointcommon.BearerToken(r); token != "" {
		ctx, cancel := context.WithTimeout(r.Context(), sharedconstants.SessionLogoutTimeout)
		defer cancel()
		if err := h.service.DeleteSession(ctx, token); err != nil {
			return fault.Wrap(fault.DependencyUnavailable, "登录会话暂时不可用，请稍后重试", err)
		}
	}
	endpointcommon.WriteJSON(w, http.StatusOK, nil)
	return nil
}

// GetCurrentSession 返回当前访问令牌对应的用户身份。
func (h *Handler) GetCurrentSession(w http.ResponseWriter, r *http.Request) error {
	user, err := h.currentUser(r)
	if err != nil {
		return err
	}
	endpointcommon.WriteJSON(w, http.StatusOK, map[string]any{"user": user})
	return nil
}

// ChangeLoginEmail 修改当前账号用于登录的邮箱。
func (h *Handler) ChangeLoginEmail(w http.ResponseWriter, r *http.Request) error {
	user, err := h.currentUser(r)
	if err != nil {
		return err
	}
	var request changeEmailRequest
	if err := decodeJSON(r, &request); err != nil {
		return err
	}
	updated, err := h.service.ChangeEmail(r.Context(), applicationidentity.ChangeEmailInput{User: user, Email: request.Email, CurrentPassword: request.CurrentPassword, Code: request.Code, Token: endpointcommon.BearerToken(r)})
	if err != nil {
		return identityFault(err, "保存新邮箱失败")
	}
	endpointcommon.WriteJSON(w, http.StatusOK, map[string]any{"user": updated})
	return nil
}

// ChangeLoginPassword 修改当前账号的登录密码。
func (h *Handler) ChangeLoginPassword(w http.ResponseWriter, r *http.Request) error {
	user, err := h.currentUser(r)
	if err != nil {
		return err
	}
	var request changePasswordRequest
	if err := decodeJSON(r, &request); err != nil {
		return err
	}
	if err := h.service.ChangePassword(r.Context(), applicationidentity.ChangePasswordInput{User: user, CurrentPassword: request.CurrentPassword, NextPassword: request.NextPassword, Code: request.Code}); err != nil {
		return identityFault(err, "保存新密码失败")
	}
	endpointcommon.WriteJSON(w, http.StatusOK, map[string]string{"message": "密码已更新"})
	return nil
}

// ResetLoginPassword 使用邮箱验证码重置未登录账号的密码。
func (h *Handler) ResetLoginPassword(w http.ResponseWriter, r *http.Request) error {
	var request resetPasswordRequest
	if err := decodeJSON(r, &request); err != nil {
		return err
	}
	if err := h.service.ResetPassword(r.Context(), applicationidentity.ResetPasswordInput{Email: request.Email, NextPassword: request.NextPassword, Code: request.Code}); err != nil {
		return identityFault(err, "保存新密码失败")
	}
	endpointcommon.WriteJSON(w, http.StatusOK, map[string]string{"message": "密码已重设，请使用新密码登录"})
	return nil
}

func decodeJSON(r *http.Request, target any) error {
	return endpointcommon.DecodeJSON(r, target)
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
