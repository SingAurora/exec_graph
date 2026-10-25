// Package router 是路径、方法和路由分组的唯一所有者。
package router

import (
	"github.com/gin-gonic/gin"
	"github.com/singaurora/exec-graph/backend/internal/http/endpoint/action"
	"github.com/singaurora/exec-graph/backend/internal/http/endpoint/catalogue"
	"github.com/singaurora/exec-graph/backend/internal/http/endpoint/common"
	"github.com/singaurora/exec-graph/backend/internal/http/endpoint/following"
	"github.com/singaurora/exec-graph/backend/internal/http/endpoint/graph"
	"github.com/singaurora/exec-graph/backend/internal/http/endpoint/identity"
	"github.com/singaurora/exec-graph/backend/internal/http/endpoint/profile"
	"github.com/singaurora/exec-graph/backend/internal/http/middleware"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
	"log/slog"
)

// New 注册当前阶段已实现的接口，不为未实现业务返回伪成功。
func New(auth *identity.Handler, read *catalogue.Handler, graphs *graph.Handler, actions *action.Handler, profiles *profile.Handler, follows *following.Handler, origins []string, logger *slog.Logger) *gin.Engine {
	gin.SetMode(gin.ReleaseMode)
	engine := gin.New()
	_ = engine.SetTrustedProxies(nil)
	engine.Use(middleware.Boundary(logger), middleware.CORS(origins))
	group := engine.Group("/api/commands")
	// 检查真实数据库及 Redis 是否就绪。
	group.GET("/system/health", read.Ready)
	// 使用邮箱密码创建真实会话。
	group.POST("/auth/login", auth.Login)
	// 显式开发模式下体验固定测试账号。
	group.POST("/auth/demo-login", auth.DemoLogin)
	// 读取当前会话资料及 CSRF token。
	group.GET("/auth/session", auth.Session)
	// 校验 CSRF 并撤销当前会话。
	group.POST("/auth/logout", auth.Logout)
	// 读取公开用户目录，不返回邮箱和测试管理字段。
	group.GET("/profiles/catalogue", read.Profiles)
	// 读取所有可见图的过渡目录。
	group.GET("/graphs/catalogue", read.Graphs)
	// 读取单张图的公开资料。
	group.GET("/graphs/detail", read.Graph)
	// 读取图内已确认的行动、表达、约定和形成过程。
	group.GET("/actions/context", read.Actions)
	// 读取单个已发布行动。
	group.GET("/actions/detail", read.Action)
	// 读取当前账号的关注对象。
	group.GET("/following/sources", read.Following)
	// 读取已就绪的站内图片文件。
	group.GET("/media/file", read.Media)
	// 创建空图，使用提交键保证重复请求只创建一次。
	group.POST("/graphs/create", graphs.Create)
	// 创建者及贡献前三位用户修改图资料。
	group.POST("/graphs/update", graphs.Update)
	// 重新检查参与者、资料版本及行动数量后逻辑删除图。
	group.POST("/graphs/delete", graphs.Delete)
	// 确认服务端 AI 文稿，原子发布行动、文档、引用和形成过程。
	group.POST("/actions/create", actions.Create)
	// 保存未被引用终点的连续 AI 对话表达。
	group.POST("/expressions/update", actions.Expression)
	// 修改未被引用终点向后传递的约定。
	group.POST("/agreements/update", actions.Agreement)
	// 保存当前账号公开资料，保持精选不变。
	group.POST("/profiles/update", profiles.Update)
	// 集中管理最多五个本人表达精选及其顺序。
	group.POST("/profiles/highlights-set", profiles.Highlights)
	// 显式设置用户或图的关注状态。
	group.POST("/following/set", follows.Set)
	engine.NoRoute(func(c *gin.Context) { common.Fail(c, fault.New(fault.NotFound, "接口不存在或尚未实现")) })
	return engine
}
