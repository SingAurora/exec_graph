// Package generation 适配平台 AI 生成和私有结果查询。
package generation

import (
	"context"

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

// PlaceImages 只对当前草稿做图片放置，不重新生成或核验正文。
func (h *Handler) PlaceImages(c *gin.Context) {
	common.CommandWithTimeout(c, h.auth, constants.AIRequestTimeout, func(ctx context.Context, actor identity.Actor, _ string, input app.PlaceImagesInput) (app.View, error) {
		return h.service.PlaceImages(ctx, actor, input)
	})
}

// Get 只向当前会话返回本人发起的生成。
func (h *Handler) Get(c *gin.Context) {
	uuid, err := common.Query(c, "generationUuid")
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

// Chat 让模型决定继续整理还是核验当前草稿，并把结果作为一条对话响应返回。
func (h *Handler) Chat(c *gin.Context) {
	common.CommandWithTimeout(c, h.auth, constants.AIRequestTimeout, func(ctx context.Context, actor identity.Actor, key string, input app.ChatInput) (app.ChatView, error) {
		return h.service.Chat(ctx, actor, key, input)
	})
}

// Verify 对已生成草稿执行一次显式核验，不自动生成新草稿。
func (h *Handler) Verify(c *gin.Context) {
	common.CommandWithTimeout(c, h.auth, constants.AIRequestTimeout, func(ctx context.Context, actor identity.Actor, _ string, input app.VerifyInput) (app.VerifyView, error) {
		return h.service.Verify(ctx, actor, input)
	})
}

// DefaultPrompts 只读返回平台当前使用的三份默认提示词。
func (h *Handler) DefaultPrompts(c *gin.Context) {
	common.Reply(c, app.DefaultPrompts())
}
