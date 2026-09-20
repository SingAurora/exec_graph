package router

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	httpendpoint "github.com/singaurora/exec-graph/backend/internal/http/endpoint"
	httpmiddleware "github.com/singaurora/exec-graph/backend/internal/http/middleware"
	httpresponse "github.com/singaurora/exec-graph/backend/internal/http/response"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
)

// New 绑定对外 HTTP 协议。业务接口按明确命令组织：读取使用 GET，
// 状态变更使用 POST；不从 URL 路径片段读取业务参数。
// Config contains transport-only router settings.
type Config struct {
	AllowedOrigins []string
	Logger         *slog.Logger
}

func New(endpoints httpendpoint.Endpoints, config Config) http.Handler {
	gin.SetMode(gin.ReleaseMode)
	logger := config.Logger
	if logger == nil {
		logger = slog.Default()
	}
	router := gin.New()
	router.Use(httpmiddleware.RequestID(), httpmiddleware.AccessLogger(logger), httpmiddleware.ErrorBoundary(logger), httpmiddleware.CORS(config.AllowedOrigins))
	router.HandleMethodNotAllowed = true
	router.NoMethod(func(context *gin.Context) {
		httpresponse.WriteFault(context.Writer, fault.New(fault.MethodNotAllowed, "不支持的请求方法"))
	})
	router.NoRoute(func(context *gin.Context) {
		httpresponse.WriteFault(context.Writer, fault.New(fault.NotFound, "接口不存在"))
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
	auth.POST("/send-verification-code", endpoints.SendVerificationCode)
	// 用邮箱验证码创建账户并建立登录会话。
	auth.POST("/register-account", endpoints.RegisterAccount)
	// 校验账号密码并创建登录会话。
	auth.POST("/login-with-password", endpoints.LoginWithPassword)
	// 销毁当前访问令牌对应的登录会话。
	auth.POST("/logout-current-session", endpoints.LogoutCurrentSession)
	// 读取当前访问令牌对应的基础身份信息。
	auth.GET("/get-current-session", endpoints.GetCurrentSession)
	// 使用验证码和当前密码修改登录邮箱。
	auth.POST("/change-login-email", endpoints.RequireAuthentication, endpoints.ChangeLoginEmail)
	// 使用验证码和当前密码修改登录密码。
	auth.POST("/change-login-password", endpoints.RequireAuthentication, endpoints.ChangeLoginPassword)
	// 使用验证码为未登录账户重置密码。
	auth.POST("/reset-login-password", endpoints.ResetLoginPassword)

	// 当前登录用户的公开资料设置与媒体上传；这些接口不能操作其他用户。
	users := commands.Group("/users", endpoints.RequireAuthentication)
	// 读取当前用户完整的公开资料与主页设置。
	users.GET("/get-current-user-profile", endpoints.GetCurrentUserProfile)
	// 更新当前用户的名称、用户 ID、简介和自定义主页设置。
	users.POST("/update-current-user-profile", endpoints.UpdateCurrentUserProfile)
	// 上传并更新当前用户的头像。
	users.POST("/upload-current-user-avatar", endpoints.UploadCurrentUserAvatar)
	// 上传并更新当前用户公开主页的背景图。
	users.POST("/upload-current-user-profile-background", endpoints.UploadCurrentUserProfileBackground)

	// 项目承载执行节点、节点图、审查配置和协作征集。读取时 projectUuid 放在
	// query，变更时放在 JSON 请求体。
	projects := commands.Group("/projects", endpoints.RequireAuthentication)
	// 列出当前用户拥有的项目及其基本状态。
	projects.GET("/list-owned-projects", endpoints.ListOwnedProjects)
	// 创建项目，并保存选定的规则、审查 AI 和可见性设置。
	projects.POST("/create-project", endpoints.CreateProject)
	// 按 projectUuid 读取一个项目的基本资料。
	projects.GET("/get-project-detail", endpoints.GetProjectDetail)
	// 更新项目名称、说明或可见性等项目资料。
	projects.POST("/update-project-profile", endpoints.UpdateProjectProfile)
	// 删除项目及其拥有的执行数据。
	projects.POST("/delete-project", endpoints.DeleteProject)
	// 按 projectUuid 读取项目节点、路径、边和完成记录组成的执行图。
	projects.GET("/get-project-execution-graph", endpoints.GetProjectExecutionGraph)
	// 向项目路径新增已通过 AI 草案审查的冻结执行节点。
	projects.POST("/create-execution-node", endpoints.CreateExecutionNode)
	// 确认审查结果，并锁定节点当前阶段。
	projects.POST("/confirm-node-completion", endpoints.ConfirmNodeCompletion)
	// 将节点的开放缺口发布给其他项目贡献。
	projects.POST("/publish-collaboration-call", endpoints.PublishCollaborationCall)
	// 开始或继续下一节点的规划对话。
	projects.POST("/open-planning-conversation", endpoints.OpenPlanningConversation)
	// 开始节点完成证据的审查对话。
	projects.POST("/open-completion-review-conversation", endpoints.OpenCompletionReviewConversation)
	// 为项目设置后续 AI 审查要使用的已验证密钥。
	projects.POST("/set-project-review-ai", endpoints.SetProjectReviewAI)
	// 为项目切换后续节点采用的规则模板。
	projects.POST("/set-project-smart-contract", endpoints.SetProjectSmartContract)
	// 归档项目，停止其继续推进但保留可追溯记录。
	projects.POST("/archive-project", endpoints.ArchiveProject)
	// 恢复已归档项目，使其可以继续推进。
	projects.POST("/restore-archived-project", endpoints.RestoreArchivedProject)

	// 公开探索展示可见项目及其协作网络。个人可贡献成果仍要求登录，因为它会
	// 暴露当前用户自己的已采纳记录。
	explore := commands.Group("/explore")
	// 列出可公开探索的项目与其开放协作机会。
	explore.GET("/list-public-projects", endpoints.ListPublicProjects)
	// 读取公开项目、成果和参与者构成的协作关系网络。
	explore.GET("/get-public-collaboration-network", endpoints.GetPublicCollaborationNetwork)
	// 按 projectUuid 读取一个公开项目的协作摘要和开放缺口。
	explore.GET("/get-public-project-detail", endpoints.GetPublicProjectDetail)
	// 按公开用户 ID 读取个人资料、公开项目和已验收成果。
	explore.GET("/get-public-user-profile", endpoints.GetPublicUserProfile)
	// 列出当前用户可提交给其他项目的公开已采纳成果。
	explore.GET("/list-contribution-source-records", endpoints.RequireAuthentication, endpoints.ListContributionSourceRecords)
	// 列出当前用户已提交贡献及其被审查、采纳的状态。
	explore.GET("/list-current-user-contributions", endpoints.RequireAuthentication, endpoints.ListCurrentUserContributions)

	// 协作征集将开放目标节点与其他项目的已采纳成果关联：先投稿，再批量审查，
	// 最后决定是否采纳。
	collaboration := commands.Group("/collaboration", endpoints.RequireAuthentication)
	// 按 callUuid 读取协作征集目标、投稿和已有审查批次。
	collaboration.GET("/get-collaboration-call-detail", endpoints.GetCollaborationCallDetail)
	// 将当前用户的一份已采纳成果投稿到开放缺口。
	collaboration.POST("/submit-project-contribution", endpoints.SubmitProjectContribution)
	// 对选定投稿发起 AI 组合审查，并生成审查批次。
	collaboration.POST("/review-contribution-batch", endpoints.ReviewContributionBatch)
	// 由目标项目维护者正式采纳一个通过的审查批次。
	collaboration.POST("/adopt-reviewed-contributions", endpoints.AdoptReviewedContributions)

	// 规则模板可在项目间复用，定义项目如何规划、验证和记录执行节点。
	contracts := commands.Group("/contracts", endpoints.RequireAuthentication)
	// 列出当前用户可选的系统规则和自建规则模板。
	contracts.GET("/list-available-smart-contracts", endpoints.ListAvailableSmartContracts)
	// 创建当前用户可复用的行动规则模板。
	contracts.POST("/create-smart-contract", endpoints.CreateSmartContract)
	// 读取规则模板创建、修改和使用相关的历史事件。
	contracts.GET("/list-smart-contract-history", endpoints.ListSmartContractHistory)
	// 按 contractUuid 读取一份规则模板的完整内容。
	contracts.GET("/get-smart-contract-detail", endpoints.GetSmartContractDetail)
	// 删除当前用户拥有且未被保护的规则模板。
	contracts.POST("/delete-smart-contract", endpoints.DeleteSmartContract)

	// AI 密钥按用户隔离。测试校验待保存配置；验证校验已保存密钥是否可用于
	// 项目审查。
	aiKeys := commands.Group("/ai-keys", endpoints.RequireAuthentication)
	// 列出当前用户保存的 AI 服务配置。
	aiKeys.GET("/list-ai-keys", endpoints.ListAIKeys)
	// 保存一份 AI 服务密钥和模型配置。
	aiKeys.POST("/create-ai-key", endpoints.CreateAIKey)
	// 用尚未保存的配置测试 AI 服务连通性。
	aiKeys.POST("/test-ai-key-configuration", endpoints.TestAIKeyConfiguration)
	// 复验一份已保存的 AI 服务配置。
	aiKeys.POST("/verify-saved-ai-key", endpoints.VerifySavedAIKey)
	// 删除一份当前用户保存的 AI 服务配置。
	aiKeys.POST("/delete-ai-key", endpoints.DeleteAIKey)

	// AI 审查覆盖节点草案、完成证据，以及未通过审查后的补充说明。
	aiReviews := commands.Group("/reviews", endpoints.RequireAuthentication)
	// 审查冻结节点提交的完成说明和逐条证据。
	aiReviews.POST("/review-node-completion", endpoints.ReviewNodeCompletion)
	// 针对未通过的验收标准提交补充说明并重新审查。
	aiReviews.POST("/review-node-clarification", endpoints.ReviewNodeClarification)
	// 审查规划对话生成的节点草案是否能冻结执行。
	aiReviews.POST("/review-node-draft", endpoints.ReviewNodeDraft)

	// 工作总览读取当前用户的每日行动日历；每日审查调用选定 AI 生成并保存日结。
	workOverview := commands.Group("/work-overview", endpoints.RequireAuthentication)
	// 按 month 读取当前用户每日推进、完成和锁定记录。
	workOverview.GET("/get-monthly-work-overview", endpoints.GetMonthlyWorkOverview)
	// 对某个已有工作记录的日期生成并保存 AI 日结。
	workOverview.POST("/review-daily-activity", endpoints.ReviewDailyActivity)

	// 规划与完成对话保存可追溯的 AI 对话，产出节点草案或冻结审查结论。
	conversations := commands.Group("/conversations", endpoints.RequireAuthentication)
	// 按 conversationUuid 读取规划或完成审查对话全文。
	conversations.GET("/get-ai-conversation", endpoints.GetAIConversation)
	// 向规划或完成审查对话发送一条用户消息并获得 AI 回复。
	conversations.POST("/send-conversation-message", endpoints.SendConversationMessage)
	// 请求 AI 对当前对话草案执行冻结审核并返回可执行结论。
	conversations.POST("/request-planning-draft-freeze-review", endpoints.RequestPlanningDraftFreezeReview)

	return router
}
