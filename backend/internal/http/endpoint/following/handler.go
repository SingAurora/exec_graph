// Package following 适配关注状态写入。
package following

import (
	"github.com/gin-gonic/gin"
	app "github.com/singaurora/exec-graph/backend/internal/application/following"
	"github.com/singaurora/exec-graph/backend/internal/application/identity"
	"github.com/singaurora/exec-graph/backend/internal/http/endpoint/common"
)

// Handler 持有关注及身份服务。
type Handler struct {
	service *app.Service
	auth    *identity.Service
}

// New 创建关注适配器。
func New(service *app.Service, auth *identity.Service) *Handler { return &Handler{service, auth} }

// Set 保存显式关注状态。
func (h *Handler) Set(c *gin.Context) { common.Mutation(c, h.auth, h.service.Set) }
