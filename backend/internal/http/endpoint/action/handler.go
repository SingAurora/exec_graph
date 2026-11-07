// Package action 适配行动和文档确认接口。
package action

import (
	"context"

	"github.com/gin-gonic/gin"
	app "github.com/singaurora/exec-graph/backend/internal/application/action"
	"github.com/singaurora/exec-graph/backend/internal/application/identity"
	nodedoc "github.com/singaurora/exec-graph/backend/internal/application/nodedoc"
	"github.com/singaurora/exec-graph/backend/internal/http/endpoint/common"
	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
)

// Handler 持有已注入的用例。
type Handler struct {
	service   *app.Service
	auth      *identity.Service
	documents *nodedoc.Service
}

// New 创建行动 HTTP 适配器；节点文档服务可选，便于不接入 AI 的单元装配。
func New(service *app.Service, auth *identity.Service, documents ...*nodedoc.Service) *Handler {
	handler := &Handler{service: service, auth: auth}
	if len(documents) > 0 {
		handler.documents = documents[0]
	}
	return handler
}

// NodeDocuments 为已发布节点生成表达/约定草案。
func (h *Handler) NodeDocuments(c *gin.Context) {
	if h.documents == nil {
		common.Fail(c, fault.New(fault.Unavailable, "平台 AI 暂未启用"))
		return
	}
	common.CommandWithTimeout(c, h.auth, constants.AIRequestTimeout, func(ctx context.Context, actor identity.Actor, _ string, input nodedoc.GenerateInput) ([]app.NodeDocument, error) {
		return h.documents.Generate(ctx, actor, input.NodeID)
	})
}

// Create 确认一份服务端行动生成结果。
func (h *Handler) Create(c *gin.Context) { common.Command(c, h.auth, h.service.Create) }

// Delete 删除尚未被接续的终端节点。
func (h *Handler) Delete(c *gin.Context) {
	common.Command(c, h.auth, func(ctx context.Context, actor identity.Actor, _ string, input app.DeleteNodeInput) (struct{}, error) {
		return struct{}{}, h.service.Delete(ctx, actor, input)
	})
}

// Documents 只向作者读取节点表达/约定草案。
func (h *Handler) Documents(c *gin.Context) {
	nodeID, err := common.Query(c, "nodeId")
	if err != nil {
		common.Fail(c, err)
		return
	}
	session, err := h.auth.Session(c.Request.Context(), common.SessionToken(c))
	if err != nil {
		common.Fail(c, err)
		return
	}
	out, err := h.service.NodeDocuments(c.Request.Context(), identity.Actor{UserID: session.User.ID, AuthVersion: session.AuthVersion}, nodeID)
	if err != nil {
		common.Fail(c, err)
		return
	}
	common.Reply(c, out)
}

// PublishDocument 发布节点当前的表达/约定草案。
func (h *Handler) PublishDocument(c *gin.Context) {
	common.Mutation(c, h.auth, h.service.PublishNodeDocument)
}

// Expression 确认当前终点的表达生成结果。
func (h *Handler) Expression(c *gin.Context) { common.Mutation(c, h.auth, h.service.UpdateExpression) }

// Agreement 更新当前终点向后传递的约定。
func (h *Handler) Agreement(c *gin.Context) { common.Mutation(c, h.auth, h.service.UpdateAgreement) }
