// Package identity 将账户用例适配为 HTTP。
package identity

import (
	"github.com/gin-gonic/gin"
	app "github.com/singaurora/exec-graph/backend/internal/application/identity"
	"github.com/singaurora/exec-graph/backend/internal/http/endpoint/common"
)

// Handler 保存已注入的服务和 cookie 策略。
type Handler struct {
	service *app.Service
	secure  bool
	maxAge  int
}

// New 创建 HTTP 适配器。
func New(service *app.Service, secure bool, maxAge int) *Handler {
	return &Handler{service, secure, maxAge}
}

// Token 读取当前版本专用 cookie，不接管旧项目会话。
func Token(c *gin.Context) string { return common.SessionToken(c) }

// Login 绑定密码登录请求。
func (h *Handler) Login(c *gin.Context) {
	var input struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := common.Bind(c, &input); err != nil {
		common.Fail(c, err)
		return
	}
	out, err := h.service.Login(c.Request.Context(), input.Email, input.Password, c.ClientIP())
	if err != nil {
		common.Fail(c, err)
		return
	}
	h.cookie(c, out.Token, h.maxAge)
	common.Reply(c, out.View)
}

// DemoLogin 仅请求固定测试号的服务端会话。
func (h *Handler) DemoLogin(c *gin.Context) {
	var input struct{}
	if err := common.Bind(c, &input); err != nil {
		common.Fail(c, err)
		return
	}
	out, err := h.service.DemoLogin(c.Request.Context(), c.ClientIP())
	if err != nil {
		common.Fail(c, err)
		return
	}
	h.cookie(c, out.Token, h.maxAge)
	common.Reply(c, out.View)
}

// Session 返回当前身份及 CSRF token。
func (h *Handler) Session(c *gin.Context) {
	out, err := h.service.Session(c.Request.Context(), Token(c))
	if err != nil {
		common.Fail(c, err)
		return
	}
	common.Reply(c, out)
}

// Logout 撤销服务端会话后清除浏览器 cookie。
func (h *Handler) Logout(c *gin.Context) {
	var input struct{}
	if err := common.Bind(c, &input); err != nil {
		common.Fail(c, err)
		return
	}
	if err := h.service.Logout(c.Request.Context(), Token(c), c.GetHeader("X-CSRF-Token")); err != nil {
		common.Fail(c, err)
		return
	}
	h.cookie(c, "", -1)
	common.Reply(c, nil)
}
func (h *Handler) cookie(c *gin.Context, value string, maxAge int) {
	common.SetSessionCookie(c, value, maxAge, h.secure)
}
