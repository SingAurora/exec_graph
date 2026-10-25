// Package profile 适配账户资料和精选管理接口。
package profile

import (
	"github.com/gin-gonic/gin"
	"github.com/singaurora/exec-graph/backend/internal/application/identity"
	app "github.com/singaurora/exec-graph/backend/internal/application/profile"
	"github.com/singaurora/exec-graph/backend/internal/http/endpoint/common"
)

// Handler 持有资料及身份服务。
type Handler struct {
	service *app.Service
	auth    *identity.Service
}

// New 创建资料适配器。
func New(service *app.Service, auth *identity.Service) *Handler { return &Handler{service, auth} }

// Update 保存公开资料。
func (h *Handler) Update(c *gin.Context) { common.Mutation(c, h.auth, h.service.Update) }

// Highlights 保存最多五个精选的顺序和选择。
func (h *Handler) Highlights(c *gin.Context) { common.Mutation(c, h.auth, h.service.SetHighlights) }
