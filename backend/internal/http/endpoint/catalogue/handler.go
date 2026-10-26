// Package catalogue 适配目录读取用例。
package catalogue

import (
	"context"
	"github.com/gin-gonic/gin"
	app "github.com/singaurora/exec-graph/backend/internal/application/catalogue"
	"github.com/singaurora/exec-graph/backend/internal/application/identity"
	"github.com/singaurora/exec-graph/backend/internal/http/endpoint/common"
	auth "github.com/singaurora/exec-graph/backend/internal/http/endpoint/identity"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
)

// Handler 持有读取及身份用例。
type Handler struct {
	service  *app.Service
	identity *identity.Service
	ready    func(context.Context) error
}

// New 注入读取和依赖探测能力。
func New(service *app.Service, identity *identity.Service, ready func(context.Context) error) *Handler {
	return &Handler{service, identity, ready}
}

// Profiles 返回不含私有字段的用户目录。
func (h *Handler) Profiles(c *gin.Context) {
	out, err := h.service.Profiles(c.Request.Context())
	if err != nil {
		common.Fail(c, err)
		return
	}
	common.Reply(c, out)
}

// Graphs 返回行动图目录。
func (h *Handler) Graphs(c *gin.Context) {
	out, err := h.service.Graphs(c.Request.Context())
	if err != nil {
		common.Fail(c, err)
		return
	}
	common.Reply(c, out)
}

// Graph 返回单图资料。
func (h *Handler) Graph(c *gin.Context) {
	uuid, err := common.Query(c, "graphId")
	if err != nil {
		common.Fail(c, err)
		return
	}
	out, err := h.service.Graph(c.Request.Context(), uuid)
	if err != nil {
		common.Fail(c, err)
		return
	}
	common.Reply(c, out)
}

// Actions 返回单图确认上下文。
func (h *Handler) Actions(c *gin.Context) {
	uuid, err := common.Query(c, "graphId")
	if err != nil {
		common.Fail(c, err)
		return
	}
	out, err := h.service.Actions(c.Request.Context(), uuid)
	if err != nil {
		common.Fail(c, err)
		return
	}
	common.Reply(c, out)
}

// Action 返回单个行动详情。
func (h *Handler) Action(c *gin.Context) {
	uuid, err := common.Query(c, "nodeId")
	if err != nil {
		common.Fail(c, err)
		return
	}
	out, err := h.service.Action(c.Request.Context(), uuid)
	if err != nil {
		common.Fail(c, err)
		return
	}
	common.Reply(c, out)
}

// Following 在验证当前会话后读取关注集合。
func (h *Handler) Following(c *gin.Context) {
	session, err := h.identity.Session(c.Request.Context(), auth.Token(c))
	if err != nil {
		common.Fail(c, err)
		return
	}
	out, err := h.service.Following(c.Request.Context(), session.User.ID)
	if err != nil {
		common.Fail(c, err)
		return
	}
	common.Reply(c, out)
}

// Ready 只有真实依赖可用时才返回就绪。
func (h *Handler) Ready(c *gin.Context) {
	if err := h.ready(c.Request.Context()); err != nil {
		common.Fail(c, fault.New(fault.Unavailable, "服务依赖暂不可用"))
		return
	}
	common.Reply(c, struct {
		Ready bool `json:"ready"`
	}{true})
}
