// Package account 适配邮件验证码、注册、找回密码与账户安全操作。
package account

import (
	"context"

	"github.com/gin-gonic/gin"
	app "github.com/singaurora/exec-graph/backend/internal/application/account"
	"github.com/singaurora/exec-graph/backend/internal/application/identity"
	"github.com/singaurora/exec-graph/backend/internal/http/endpoint/common"
	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
)

// Handler 持有账户用例、会话校验和 cookie 策略。
type Handler struct {
	service *app.Service
	auth    *identity.Service
}

// New 由组合根注入依赖。
func New(service *app.Service, auth *identity.Service) *Handler {
	return &Handler{service, auth}
}

// Code 绑定发送用途；修改密码或邮箱时必须同时通过会话。
func (h *Handler) Code(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), constants.HTTPRequestTimeout)
	defer cancel()
	var input app.CodeInput
	if err := common.Bind(c, &input); err != nil {
		common.Fail(c, err)
		return
	}
	var actor identity.Actor
	if input.Purpose == "change-password" || input.Purpose == "change-email" {
		var err error
		actor, err = h.auth.Authorize(ctx, common.SessionToken(c))
		if err != nil {
			common.Fail(c, err)
			return
		}
	}
	out, err := h.service.SendCode(ctx, actor, input, c.ClientIP())
	if err != nil {
		common.Fail(c, err)
		return
	}
	common.Reply(c, out)
}

// Register 校验邮箱并建立真实会话，响应不包含密码或验证码。
func (h *Handler) Register(c *gin.Context) {
	var input app.RegisterInput
	if err := common.Bind(c, &input); err != nil {
		common.Fail(c, err)
		return
	}
	out, err := h.service.Register(c.Request.Context(), input, c.ClientIP())
	if err != nil {
		common.Fail(c, err)
		return
	}
	out.View.Token = out.Token
	common.Reply(c, out.View)
}

// ResetPassword 成功后撤销全部旧认证版本，并清除此浏览器旧 cookie。
func (h *Handler) ResetPassword(c *gin.Context) {
	var input app.ResetInput
	if err := common.Bind(c, &input); err != nil {
		common.Fail(c, err)
		return
	}
	if err := h.service.ResetPassword(c.Request.Context(), input); err != nil {
		common.Fail(c, err)
		return
	}
	common.Reply(c, nil)
}

// ChangePassword 校验当前密码与绑定邮箱后要求重新登录。
func (h *Handler) ChangePassword(c *gin.Context) {
	common.Mutation(c, h.auth, func(ctx context.Context, actor identity.Actor, input app.ChangePasswordInput) (struct{}, error) {
		out, err := h.service.ChangePassword(ctx, actor, input)
		return out, err
	})
}

// ChangeEmail 校验当前密码与新邮箱后要求重新登录。
func (h *Handler) ChangeEmail(c *gin.Context) {
	common.Mutation(c, h.auth, func(ctx context.Context, actor identity.Actor, input app.ChangeEmailInput) (struct{}, error) {
		out, err := h.service.ChangeEmail(ctx, actor, input)
		return out, err
	})
}
