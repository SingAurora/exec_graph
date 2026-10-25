// Package graph 适配图写入接口。
package graph

import (
	"context"
	"github.com/gin-gonic/gin"
	app "github.com/singaurora/exec-graph/backend/internal/application/graph"
	"github.com/singaurora/exec-graph/backend/internal/application/identity"
	"github.com/singaurora/exec-graph/backend/internal/http/endpoint/common"
)

// Handler 只包含应用服务，不访问数据库。
type Handler struct {
	service *app.Service
	auth    *identity.Service
}

// New 注入图及身份服务。
func New(service *app.Service, auth *identity.Service) *Handler { return &Handler{service, auth} }

// Create 创建空图。
func (h *Handler) Create(c *gin.Context) { common.Command(c, h.auth, h.service.Create) }

// Update 修改图资料。
func (h *Handler) Update(c *gin.Context) { common.Mutation(c, h.auth, h.service.Update) }

// Delete 校验数量后逻辑删除图。
func (h *Handler) Delete(c *gin.Context) {
	common.Mutation(c, h.auth, func(ctx context.Context, actor identity.Actor, input app.DeleteGraphInput) (*struct{}, error) {
		return nil, h.service.Delete(ctx, actor, input)
	})
}
