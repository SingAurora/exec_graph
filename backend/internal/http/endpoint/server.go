package endpoint

import (
	"time"

	applicationaikey "github.com/singaurora/exec-graph/backend/internal/application/aikey"
	applicationcollaboration "github.com/singaurora/exec-graph/backend/internal/application/collaboration"
	applicationidentity "github.com/singaurora/exec-graph/backend/internal/application/identity"
	applicationnetwork "github.com/singaurora/exec-graph/backend/internal/application/network"
	applicationproject "github.com/singaurora/exec-graph/backend/internal/application/project"
	bootstrapconfig "github.com/singaurora/exec-graph/backend/internal/bootstrap/config"
	aikeyendpoint "github.com/singaurora/exec-graph/backend/internal/http/endpoint/aikey"
	identityendpoint "github.com/singaurora/exec-graph/backend/internal/http/endpoint/identity"
	networkendpoint "github.com/singaurora/exec-graph/backend/internal/http/endpoint/network"
	profileendpoint "github.com/singaurora/exec-graph/backend/internal/http/endpoint/profile"
	projectendpoint "github.com/singaurora/exec-graph/backend/internal/http/endpoint/project"
	workflowendpoint "github.com/singaurora/exec-graph/backend/internal/http/endpoint/workflow"
	infrastructuremail "github.com/singaurora/exec-graph/backend/internal/infrastructure/mail"
	aikeypersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/aikey"
	collaborationpersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/collaboration"
	contractpersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/contract"
	conversationpersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/conversation"
	executionpersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/execution"
	identitypersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/identity"
	networkpersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/network"
	projectpersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/project"
	reviewpersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/review"
	workoverviewpersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/workoverview"
	infrastructureredis "github.com/singaurora/exec-graph/backend/internal/infrastructure/redis"
	infrastructurestorage "github.com/singaurora/exec-graph/backend/internal/infrastructure/storage"
	"gorm.io/gorm"
)

// Dependencies 是 HTTP API 运行所需的基础设施实例。
//
// 这些对象由 bootstrap 层负责创建和配置，endpoint 层只接收已经组装好的
// 依赖，不在请求处理层自行连接数据库、Redis、邮件服务或对象存储。
type Dependencies struct {
	ORM     *gorm.DB                            // GORM 数据库连接，供各业务仓储创建查询。
	Mailer  *infrastructuremail.Mailer          // 邮件客户端，用于发送验证码等邮件。
	Storage infrastructurestorage.ObjectStorage // 通用对象存储，用于头像、背景图等文件。
	Redis   *infrastructureredis.SessionStore   // Redis 会话存储，登录态的强依赖。
	Config  bootstrapconfig.Config              // 已解析并校验的运行配置。
}

type Server struct {
	// 持久化仓储：负责把业务数据读写到数据库。
	//
	// Store/Repository 只应该关注 SQL、事务和数据映射，不负责决定业务是否
	// 合法。当前部分较早的 endpoint 还直接使用这些仓储，后续可以继续把
	// 业务规则收拢到 application service 中。
	identityStore      identitypersistence.IdentityRepository // 用户、邮箱验证码和账号资料。
	aiKeyStore         aikeypersistence.AIKeyRepository       // 用户及项目使用的 AI Key。
	reviews            *reviewpersistence.Repository          // 节点审查、验收及审查记录。
	conversations      *conversationpersistence.Repository    // AI 对话、消息和对话草稿。
	collaborationStore *collaborationpersistence.Repository   // 协作征集、投稿、审查和采纳。
	workOverview       *workoverviewpersistence.Repository    // 工作总览、每日行动和日审查。

	// 外部基础设施：业务服务或 handler 通过这些对象访问外部系统。
	mailer  *infrastructuremail.Mailer          // 邮件发送。
	storage infrastructurestorage.ObjectStorage // 文件上传、签名 URL 和删除。
	redis   *infrastructureredis.SessionStore   // 登录会话的保存、读取和删除。
	config  bootstrapconfig.Config              // endpoint 需要读取的运行配置。

	// 应用服务：封装跨接口复用的业务规则。
	//
	// Handler 负责 HTTP 适配，例如解析请求和写响应；Service 负责业务动作，
	// 例如“能否修改项目”“如何创建节点”“验证码能否使用”。
	identity      *applicationidentity.Service      // 注册、登录、验证码、密码和邮箱变更。
	project       *applicationproject.Service       // 项目、执行节点、智能合约和项目状态。
	network       *applicationnetwork.Service       // 探索页的公开人物/项目关系网络。
	aiKey         *applicationaikey.Service         // AI Key 的创建、验证、查询和删除。
	collaboration *applicationcollaboration.Service // 协作机会、投稿、审查和采纳。

	projectEndpoints  *projectendpoint.Handler  // 项目与规则模板 HTTP 适配。
	networkEndpoints  *networkendpoint.Handler  // 探索网络 HTTP 适配。
	aiKeyEndpoints    *aikeyendpoint.Handler    // AI 密钥 HTTP 适配。
	identityEndpoints *identityendpoint.Handler // 身份认证和账户凭据 HTTP 适配。
	profileEndpoints  *profileendpoint.Handler  // 当前用户资料和媒体上传 HTTP 适配。
	workflowEndpoints *workflowendpoint.Handler // 执行流、审查、协作和对话 HTTP 适配。
}

func NewServer(dependencies Dependencies) *Server {
	// 第一步：从同一个 GORM 连接创建各业务域的数据库仓储。
	// 仓储按业务域拆分，避免所有 handler 共享一个“万能数据库对象”。
	identityStore := identitypersistence.NewIdentityRepository(dependencies.ORM)
	aiKeyStore := aikeypersistence.NewAIKeyRepository(dependencies.ORM)
	server := &Server{
		identityStore:      identityStore,
		aiKeyStore:         aiKeyStore,
		reviews:            reviewpersistence.NewRepository(dependencies.ORM),
		conversations:      conversationpersistence.NewRepository(dependencies.ORM),
		collaborationStore: collaborationpersistence.NewRepository(dependencies.ORM),
		workOverview:       workoverviewpersistence.NewRepository(dependencies.ORM),
		mailer:             dependencies.Mailer,
		storage:            dependencies.Storage,
		redis:              dependencies.Redis,
		config:             dependencies.Config,
	}

	// 第二步：组装 application service。
	//
	// Service 接收仓储和外部依赖，向 handler 提供稳定的业务操作入口。
	// 例如身份服务内部会使用 identityStore、邮件服务和 Redis，
	// 项目服务内部会使用项目、合约和执行节点仓储。
	server.identity = applicationidentity.New(applicationidentity.Dependencies{
		Repository: identityStore,
		Contracts:  contractpersistence.NewSmartContractRepository(dependencies.ORM),
		Mailer:     dependencies.Mailer, Sessions: dependencies.Redis,
		CodeTTL:    time.Duration(dependencies.Config.Mail.CodeTTLMinutes) * time.Minute,
		SessionTTL: time.Duration(dependencies.Config.App.SessionTTLHours) * time.Hour,
	})
	server.project = applicationproject.New(
		projectpersistence.NewProjectRepository(dependencies.ORM),
		contractpersistence.NewSmartContractRepository(dependencies.ORM),
		executionpersistence.NewRepository(dependencies.ORM),
	)
	server.network = applicationnetwork.New(networkpersistence.NewRepository(dependencies.ORM))
	server.aiKey = applicationaikey.New(aiKeyStore)
	server.collaboration = applicationcollaboration.New(collaborationpersistence.NewRepository(dependencies.ORM))

	server.projectEndpoints = projectendpoint.New(server.project)
	server.networkEndpoints = networkendpoint.New(server.network)
	server.aiKeyEndpoints = aikeyendpoint.New(server.aiKey)
	server.identityEndpoints = identityendpoint.New(server.identity, server.requireUserError)
	server.profileEndpoints = profileendpoint.New(profileendpoint.Dependencies{
		IdentityStore: identityStore,
		Storage:       dependencies.Storage,
		RequireUser:   server.requireUser,
		CacheSession:  server.cacheSession,
	})
	server.workflowEndpoints = workflowendpoint.New(workflowendpoint.Dependencies{
		Project:            server.project,
		Collaboration:      server.collaboration,
		AIKeyStore:         aiKeyStore,
		Reviews:            server.reviews,
		Conversations:      server.conversations,
		CollaborationStore: server.collaborationStore,
		WorkOverview:       server.workOverview,
		RequireUser:        server.requireUser,
	})

	// 第三步：返回已经完成依赖注入的 HTTP endpoint Server。
	// router 后续只从 server.Endpoints() 取得处理函数，不需要知道这些依赖
	// 是如何创建的。
	return server
}
