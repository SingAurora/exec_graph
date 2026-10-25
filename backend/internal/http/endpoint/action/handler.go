// Package action 适配行动和文档确认接口。
package action

import (
	"github.com/gin-gonic/gin"
	app "github.com/singaurora/exec-graph/backend/internal/application/action"
	"github.com/singaurora/exec-graph/backend/internal/application/identity"
	"github.com/singaurora/exec-graph/backend/internal/http/endpoint/common"
)

// Handler 持有已注入的用例。
type Handler struct {
	service *app.Service
	auth    *identity.Service
}

// New 创建行动 HTTP 适配器。
func New(service *app.Service, auth *identity.Service) *Handler { return &Handler{service, auth} }

// Create 确认一份服务端行动生成结果。
func (h *Handler) Create(c *gin.Context) { common.Command(c, h.auth, h.service.Create) }

// Expression 确认当前终点的表达生成结果。
func (h *Handler) Expression(c *gin.Context) { common.Mutation(c, h.auth, h.service.UpdateExpression) }

// Agreement 更新当前终点向后传递的约定。
func (h *Handler) Agreement(c *gin.Context) { common.Mutation(c, h.auth, h.service.UpdateAgreement) }
