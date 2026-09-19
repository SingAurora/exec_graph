package router

import (
	"net/http"

	"github.com/gin-gonic/gin"
	httpendpoint "github.com/singaurora/exec-graph/backend/internal/http/endpoint"
	httpmiddleware "github.com/singaurora/exec-graph/backend/internal/http/middleware"
)

// New 绑定对外 HTTP 协议。业务接口按明确命令组织：读取使用 GET，
// 状态变更使用 POST；不从 URL 路径片段读取业务参数。
func New(endpoints httpendpoint.Endpoints) http.Handler {
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	router.Use(gin.Logger(), gin.Recovery(), httpmiddleware.CORS())
	router.HandleMethodNotAllowed = true
	router.NoMethod(func(context *gin.Context) {
		context.JSON(http.StatusMethodNotAllowed, gin.H{"error": "不支持的请求方法"})
	})
	router.NoRoute(func(context *gin.Context) {
		context.JSON(http.StatusNotFound, gin.H{"error": "接口不存在"})
	})

	api := router.Group("/api")
	// 用于部署与本地开发的存活探针；不读取用户数据，也是唯一不在
	// /commands 下的接口。
	// 返回服务存活状态，供负载均衡、部署探针和本地排障使用。
	api.GET("/health", endpoints.Health)

	// 命令按业务能力分组。GET 仅读取状态；POST 创建、更新、审查或
	// 以其他方式改变状态。
	commands := api.Group("/commands")

	// 身份认证与账户凭据：注册、登录、登出、验证码，以及修改当前账户凭据。
	auth := commands.Group("/auth")
	// 向注册、改邮箱、改密码或重置密码流程发送验证码。
	auth.POST("/send-code", endpoints.SendCode)
	// 用邮箱验证码创建账户并建立登录会话。
	auth.POST("/register", endpoints.Register)
	// 校验账号密码并创建登录会话。
	auth.POST("/login", endpoints.Login)
	// 销毁当前访问令牌对应的登录会话。
	auth.POST("/logout", endpoints.Logout)
	// 读取当前访问令牌对应的基础身份信息。
	auth.GET("/me", endpoints.CurrentAuth)
	// 使用验证码和当前密码修改登录邮箱。
	auth.POST("/change-email", endpoints.RequireAuthentication, endpoints.ChangeEmail)
	// 使用验证码和当前密码修改登录密码。
	auth.POST("/change-password", endpoints.RequireAuthentication, endpoints.ChangePassword)
	// 使用验证码为未登录账户重置密码。
	auth.POST("/reset-password", endpoints.ResetPassword)

	// 当前登录用户的公开资料设置与媒体上传；这些接口不能操作其他用户。
	users := commands.Group("/users", endpoints.RequireAuthentication)
	// 读取当前用户完整的公开资料与主页设置。
	users.GET("/me", endpoints.CurrentUser)
	// 更新当前用户的名称、用户 ID、简介和自定义主页设置。
	users.POST("/me/update", endpoints.UpdateCurrentUser)
	// 上传并更新当前用户的头像。
	users.POST("/me/upload-avatar", endpoints.UploadAvatar)
	// 上传并更新当前用户公开主页的背景图。
	users.POST("/me/upload-background", endpoints.UploadBackground)

	// 项目承载执行节点、节点图、审查配置和协作征集。读取时 projectId 放在
	// query，变更时放在 JSON 请求体。
	projects := commands.Group("/projects", endpoints.RequireAuthentication)
	// 列出当前用户拥有的项目及其基本状态。
	projects.GET("/list", endpoints.ListProjects)
	// 创建项目，并保存选定的规则、审查 AI 和可见性设置。
	projects.POST("/create", endpoints.CreateProject)
	// 按 projectId 读取一个项目的基本资料。
	projects.GET("/get", endpoints.GetProject)
	// 更新项目名称、说明或可见性等项目资料。
	projects.POST("/update", endpoints.UpdateProject)
	// 删除项目及其拥有的执行数据。
	projects.POST("/delete", endpoints.DeleteProject)
	// 按 projectId 读取项目节点、路径、边和完成记录组成的执行图。
	projects.GET("/graph", endpoints.GetProjectGraph)
	// 向项目路径新增已通过 AI 草案审查的冻结执行节点。
	projects.POST("/create-node", endpoints.CreateNode)
	// 确认审查结果，并锁定节点当前阶段。
	projects.POST("/lock-node", endpoints.LockNode)
	// 将节点的开放缺口发布给其他项目贡献。
	projects.POST("/create-collaboration-call", endpoints.CreateCall)
	// 开始或继续下一节点的规划对话。
	projects.POST("/create-planning-conversation", endpoints.CreatePlanningChat)
	// 开始节点完成证据的审查对话。
	projects.POST("/create-completion-conversation", endpoints.CreateCompletionChat)
	// 为项目设置后续 AI 审查要使用的已验证密钥。
	projects.POST("/set-ai-key", endpoints.SetProjectAIKey)
	// 为项目切换后续节点采用的规则模板。
	projects.POST("/set-contract", endpoints.SetProjectContract)
	// 归档项目，停止其继续推进但保留可追溯记录。
	projects.POST("/archive", endpoints.ArchiveProject)
	// 恢复已归档项目，使其可以继续推进。
	projects.POST("/unarchive", endpoints.UnarchiveProject)

	// 公开探索展示可见项目及其协作网络。个人可贡献成果仍要求登录，因为它会
	// 暴露当前用户自己的已采纳记录。
	explore := commands.Group("/explore")
	// 列出可公开探索的项目与其开放协作机会。
	explore.GET("/projects/list", endpoints.ExploreProjects)
	// 读取公开项目、成果和参与者构成的协作关系网络。
	explore.GET("/network/get", endpoints.ExploreNetwork)
	// 按 projectId 读取一个公开项目的协作摘要和开放缺口。
	explore.GET("/projects/get", endpoints.ExploreProject)
	// 列出当前用户可提交给其他项目的公开已采纳成果。
	explore.GET("/contribution-sources/list", endpoints.RequireAuthentication, endpoints.ContributionSources)
	// 列出当前用户已提交贡献及其被审查、采纳的状态。
	explore.GET("/my-contributions/list", endpoints.RequireAuthentication, endpoints.MyContributions)

	// 协作征集将开放目标节点与其他项目的已采纳成果关联：先投稿，再批量审查，
	// 最后决定是否采纳。
	collaboration := commands.Group("/collaboration", endpoints.RequireAuthentication)
	// 按 callId 读取协作征集目标、投稿和已有审查批次。
	collaboration.GET("/get", endpoints.GetCall)
	// 将当前用户的一份已采纳成果投稿到开放缺口。
	collaboration.POST("/submit", endpoints.SubmitContribution)
	// 对选定投稿发起 AI 组合审查，并生成审查批次。
	collaboration.POST("/review", endpoints.ReviewContributions)
	// 由目标项目维护者正式采纳一个通过的审查批次。
	collaboration.POST("/adopt", endpoints.AdoptReview)

	// 规则模板可在项目间复用，定义项目如何规划、验证和记录执行节点。
	contracts := commands.Group("/contracts", endpoints.RequireAuthentication)
	// 列出当前用户可选的系统规则和自建规则模板。
	contracts.GET("/list", endpoints.ListContracts)
	// 创建当前用户可复用的行动规则模板。
	contracts.POST("/create", endpoints.CreateContract)
	// 读取规则模板创建、修改和使用相关的历史事件。
	contracts.GET("/history", endpoints.ListContractHistory)
	// 按 contractId 读取一份规则模板的完整内容。
	contracts.GET("/get", endpoints.GetContract)
	// 删除当前用户拥有且未被保护的规则模板。
	contracts.POST("/delete", endpoints.DeleteContract)

	// AI 密钥按用户隔离。测试校验待保存配置；验证校验已保存密钥是否可用于
	// 项目审查。
	aiKeys := commands.Group("/ai-keys", endpoints.RequireAuthentication)
	// 列出当前用户保存的 AI 服务配置。
	aiKeys.GET("/list", endpoints.ListAIKeys)
	// 保存一份 AI 服务密钥和模型配置。
	aiKeys.POST("/create", endpoints.CreateAIKey)
	// 用尚未保存的配置测试 AI 服务连通性。
	aiKeys.POST("/test", endpoints.TestAIKey)
	// 复验一份已保存的 AI 服务配置。
	aiKeys.POST("/verify", endpoints.VerifyAIKey)
	// 删除一份当前用户保存的 AI 服务配置。
	aiKeys.POST("/delete", endpoints.DeleteAIKey)

	// AI 审查覆盖节点草案、完成证据，以及未通过审查后的补充说明。
	aiReviews := commands.Group("/reviews", endpoints.RequireAuthentication)
	// 审查冻结节点提交的完成说明和逐条证据。
	aiReviews.POST("/node", endpoints.ReviewNode)
	// 针对未通过的验收标准提交补充说明并重新审查。
	aiReviews.POST("/node/clarification", endpoints.ClarifyNodeReview)
	// 审查规划对话生成的节点草案是否能冻结执行。
	aiReviews.POST("/node-draft", endpoints.ReviewNodeDraft)

	// 工作总览读取当前用户的每日行动日历；每日审查调用选定 AI 生成并保存日结。
	workOverview := commands.Group("/work-overview", endpoints.RequireAuthentication)
	// 按 month 读取当前用户每日推进、完成和锁定记录。
	workOverview.GET("/get", endpoints.WorkOverview)
	// 对某个已有工作记录的日期生成并保存 AI 日结。
	workOverview.POST("/review-day", endpoints.ReviewWorkDay)

	// 规划与完成对话保存可追溯的 AI 对话，产出节点草案或冻结审查结论。
	conversations := commands.Group("/conversations", endpoints.RequireAuthentication)
	// 按 conversationId 读取规划或完成审查对话全文。
	conversations.GET("/get", endpoints.GetConversation)
	// 向规划或完成审查对话发送一条用户消息并获得 AI 回复。
	conversations.POST("/send-message", endpoints.SendMessage)
	// 请求 AI 对当前对话草案执行冻结审核并返回可执行结论。
	conversations.POST("/freeze-review", endpoints.FreezeReview)

	return router
}
