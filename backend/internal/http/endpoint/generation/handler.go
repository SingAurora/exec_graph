// Package generation 适配平台 AI 生成和私有结果查询。
package generation

import (
	"github.com/gin-gonic/gin"
	app "github.com/singaurora/exec-graph/backend/internal/application/generation"
	"github.com/singaurora/exec-graph/backend/internal/application/identity"
	"github.com/singaurora/exec-graph/backend/internal/http/endpoint/common"
	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
)

// Handler 持有生成和身份用例。
type Handler struct {
	service *app.Service
	auth    *identity.Service
}

// New 创建平台生成端点。
func New(service *app.Service, auth *identity.Service) *Handler { return &Handler{service, auth} }

// Generate 使用服务端上下文和平台密钥生成，浏览器不提交 system prompt。
func (h *Handler) Generate(c *gin.Context) {
	common.CommandWithTimeout(c, h.auth, constants.AIRequestTimeout, h.service.Generate)
}

// Get 只向当前会话返回本人发起的生成。
func (h *Handler) Get(c *gin.Context) {
	uuid, err := common.Query(c, "generationId")
	if err != nil {
		common.Fail(c, err)
		return
	}
	session, err := h.auth.Session(c.Request.Context(), common.SessionToken(c))
	if err != nil {
		common.Fail(c, err)
		return
	}
	out, err := h.service.Get(c.Request.Context(), identity.Actor{UserID: session.User.ID, AuthVersion: session.AuthVersion}, uuid)
	if err != nil {
		common.Fail(c, err)
		return
	}
	common.Reply(c, out)
}
