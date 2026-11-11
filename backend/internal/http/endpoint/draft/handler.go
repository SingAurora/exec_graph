// Package draft 适配云端草稿 HTTP 请求。
package draft

import (
	"github.com/gin-gonic/gin"
	app "github.com/singaurora/exec-graph/backend/internal/application/draft"
	"github.com/singaurora/exec-graph/backend/internal/application/identity"
	"github.com/singaurora/exec-graph/backend/internal/http/endpoint/common"
	auth "github.com/singaurora/exec-graph/backend/internal/http/endpoint/identity"
)

// Handler 持有草稿用例和身份能力。
type Handler struct {
	service  *app.Service
	identity *identity.Service
}

// New 创建草稿 handler。
func New(service *app.Service, identity *identity.Service) *Handler {
	return &Handler{service, identity}
}

func scopeFromQuery(c *gin.Context) app.Scope {
	scope := app.Scope{Type: c.Query("type"), GraphUUID: c.Query("graphUuid")}
	if value := c.Query("nodeUuid"); value != "" {
		scope.NodeUUID = &value
	}
	if value := c.Query("parentUuid"); value != "" {
		scope.ParentUUID = &value
	}
	return scope
}

// Get 读取并续期草稿。
func (h *Handler) Get(c *gin.Context) {
	session, err := h.identity.Session(c.Request.Context(), auth.Token(c))
	if err != nil {
		common.Fail(c, err)
		return
	}
	out, err := h.service.Get(c.Request.Context(), identity.Actor{UserID: session.User.ID, AuthVersion: session.AuthVersion}, scopeFromQuery(c))
	if err != nil {
		common.Fail(c, err)
		return
	}
	common.Reply(c, out)
}

// Save 新建或更新草稿。
func (h *Handler) Save(c *gin.Context) {
	var input app.SaveInput
	if err := common.Bind(c, &input); err != nil {
		common.Fail(c, err)
		return
	}
	session, err := h.identity.Session(c.Request.Context(), auth.Token(c))
	if err != nil {
		common.Fail(c, err)
		return
	}
	out, err := h.service.Save(c.Request.Context(), identity.Actor{UserID: session.User.ID, AuthVersion: session.AuthVersion}, input)
	if err != nil {
		common.Fail(c, err)
		return
	}
	common.Reply(c, out)
}

// Delete 删除草稿并标记图片回收。
func (h *Handler) Delete(c *gin.Context) {
	var input app.DeleteInput
	if err := common.Bind(c, &input); err != nil {
		common.Fail(c, err)
		return
	}
	session, err := h.identity.Session(c.Request.Context(), auth.Token(c))
	if err != nil {
		common.Fail(c, err)
		return
	}
	if err := h.service.Delete(c.Request.Context(), identity.Actor{UserID: session.User.ID, AuthVersion: session.AuthVersion}, input); err != nil {
		common.Fail(c, err)
		return
	}
	common.Reply(c, nil)
}
