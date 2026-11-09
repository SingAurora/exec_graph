// Package catalogue 适配目录读取用例。
package catalogue

import (
	"context"
	"strconv"

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

// Feed 返回表达或约定内容流的一页，以及该页需要的祖先子图。
func (h *Handler) Feed(c *gin.Context) {
	kind := c.Query("kind")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	out, err := h.service.Feed(c.Request.Context(), kind, page, limit)
	if err != nil {
		common.Fail(c, err)
		return
	}
	common.Reply(c, out)
}

// ProfileContent 返回单个用户主页所需的图和行动子图。
func (h *Handler) ProfileContent(c *gin.Context) {
	uuid, err := common.Query(c, "userUuid")
	if err != nil {
		common.Fail(c, err)
		return
	}
	out, err := h.service.ProfileContent(c.Request.Context(), uuid)
	if err != nil {
		common.Fail(c, err)
		return
	}
	common.Reply(c, out)
}

// ProfileStats 返回当前账号侧栏统计。
func (h *Handler) ProfileStats(c *gin.Context) {
	uuid, err := common.Query(c, "userUuid")
	if err != nil {
		common.Fail(c, err)
		return
	}
	out, err := h.service.ProfileStats(c.Request.Context(), uuid)
	if err != nil {
		common.Fail(c, err)
		return
	}
	common.Reply(c, out)
}

// GraphsPage 返回图目录的一页。
func (h *Handler) GraphsPage(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	userID := ""
	if session, err := h.identity.Session(c.Request.Context(), auth.Token(c)); err == nil {
		userID = session.User.ID
	}
	out, err := h.service.GraphsPage(c.Request.Context(), page, size, c.DefaultQuery("filter", "all"), c.Query("keyword"), c.DefaultQuery("sort", "activity"), userID)
	if err != nil {
		common.Fail(c, err)
		return
	}
	common.Reply(c, out)
}

// Graph 返回单图资料。
func (h *Handler) Graph(c *gin.Context) {
	uuid, err := common.Query(c, "graphUuid")
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
	uuid, err := common.Query(c, "graphUuid")
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
	uuid, err := common.Query(c, "nodeUuid")
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

// FollowingContent 返回当前账号关注页所需的图和行动子图。
func (h *Handler) FollowingContent(c *gin.Context) {
	session, err := h.identity.Session(c.Request.Context(), auth.Token(c))
	if err != nil {
		common.Fail(c, err)
		return
	}
	out, err := h.service.FollowingContent(c.Request.Context(), session.User.ID)
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

// ProfileInfo 读取单个用户资料。
func (h *Handler) ProfileInfo(c *gin.Context) {
	uuid, err := common.Query(c, "userUuid")
	if err != nil {
		common.Fail(c, err)
		return
	}
	out, err := h.service.ProfileInfo(c.Request.Context(), uuid)
	if err != nil {
		common.Fail(c, err)
		return
	}
	common.Reply(c, out)
}

// ProfileResource 读取用户行动、表达、约定或图列表。
func (h *Handler) ProfileResource(c *gin.Context) {
	resource := c.Param("resource")
	uuid, err := common.Query(c, "userUuid")
	if err != nil {
		common.Fail(c, err)
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	if resource == "graph" {
		out, err := h.service.ProfileGraphPage(c.Request.Context(), uuid, page, size)
		if err != nil {
			common.Fail(c, err)
			return
		}
		common.Reply(c, out)
		return
	}
	out, err := h.service.ProfileActionPage(c.Request.Context(), uuid, resource, page, size)
	if err != nil {
		common.Fail(c, err)
		return
	}
	common.Reply(c, out)
}

// FollowingSourceList 读取关注关系。
func (h *Handler) FollowingSourceList(c *gin.Context) {
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

// FollowingResource 读取关注表达、约定、图或用户列表。
func (h *Handler) FollowingResource(c *gin.Context) {
	resource := c.Param("resource")
	session, err := h.identity.Session(c.Request.Context(), auth.Token(c))
	if err != nil {
		common.Fail(c, err)
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	switch resource {
	case "graph":
		out, err := h.service.FollowingGraphPage(c.Request.Context(), session.User.ID, page, size)
		if err != nil {
			common.Fail(c, err)
			return
		}
		common.Reply(c, out)
	case "user":
		out, err := h.service.FollowingUserPage(c.Request.Context(), session.User.ID, page, size)
		if err != nil {
			common.Fail(c, err)
			return
		}
		common.Reply(c, out)
	default:
		out, err := h.service.FollowingActionPage(c.Request.Context(), session.User.ID, resource, page, size)
		if err != nil {
			common.Fail(c, err)
			return
		}
		common.Reply(c, out)
	}
}

// FeedExpressionList 读取首页表达流。
func (h *Handler) FeedExpressionList(c *gin.Context) { h.feed(c, "expressions") }

// FeedAgreementList 读取首页约定流。
func (h *Handler) FeedAgreementList(c *gin.Context) { h.feed(c, "agreements") }
func (h *Handler) feed(c *gin.Context, kind string) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	out, err := h.service.Feed(c.Request.Context(), kind, page, limit)
	if err != nil {
		common.Fail(c, err)
		return
	}
	common.Reply(c, out)
}

// ProfileExpressionList 读取用户表达列表。
func (h *Handler) ProfileExpressionList(c *gin.Context) { h.profileResource(c, "expression") }

// ProfileAgreementList 读取用户约定列表。
func (h *Handler) ProfileAgreementList(c *gin.Context) { h.profileResource(c, "agreement") }

// ProfileActionList 读取用户行动列表。
func (h *Handler) ProfileActionList(c *gin.Context) { h.profileResource(c, "action") }

// ProfileGraphList 读取用户图列表。
func (h *Handler) ProfileGraphList(c *gin.Context) { h.profileResource(c, "graph") }

func (h *Handler) profileResource(c *gin.Context, resource string) {
	uuid := c.Query("userUuid")
	if uuid == "" {
		common.Fail(c, fault.New(fault.Invalid, "查询参数不合法"))
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	if resource == "graph" {
		out, err := h.service.ProfileGraphPage(c.Request.Context(), uuid, page, size)
		if err != nil {
			common.Fail(c, err)
			return
		}
		common.Reply(c, out)
		return
	}
	out, err := h.service.ProfileActionPage(c.Request.Context(), uuid, resource, page, size)
	if err != nil {
		common.Fail(c, err)
		return
	}
	common.Reply(c, out)
}

// FollowingExpressionList 读取关注表达列表。
func (h *Handler) FollowingExpressionList(c *gin.Context) { h.followingResource(c, "expression") }

// FollowingAgreementList 读取关注约定列表。
func (h *Handler) FollowingAgreementList(c *gin.Context) { h.followingResource(c, "agreement") }

// FollowingGraphList 读取关注图列表。
func (h *Handler) FollowingGraphList(c *gin.Context) { h.followingResource(c, "graph") }

// FollowingUserList 读取关注用户列表。
func (h *Handler) FollowingUserList(c *gin.Context) { h.followingResource(c, "user") }

func (h *Handler) followingResource(c *gin.Context, resource string) {
	session, err := h.identity.Session(c.Request.Context(), auth.Token(c))
	if err != nil {
		common.Fail(c, err)
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	switch resource {
	case "graph":
		out, err := h.service.FollowingGraphPage(c.Request.Context(), session.User.ID, page, size)
		if err != nil {
			common.Fail(c, err)
			return
		}
		common.Reply(c, out)
	case "user":
		out, err := h.service.FollowingUserPage(c.Request.Context(), session.User.ID, page, size)
		if err != nil {
			common.Fail(c, err)
			return
		}
		common.Reply(c, out)
	default:
		out, err := h.service.FollowingActionPage(c.Request.Context(), session.User.ID, resource, page, size)
		if err != nil {
			common.Fail(c, err)
			return
		}
		common.Reply(c, out)
	}
}
