package endpoint

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
)

// errorHandler 是无须认证的 endpoint 函数签名。业务错误由统一错误边界转换为 HTTP 响应。
type errorHandler func(http.ResponseWriter, *http.Request) error

// authenticatedErrorHandler 同时携带已认证用户，业务错误仍交给统一错误边界处理。
type authenticatedErrorHandler func(http.ResponseWriter, *http.Request, authenticatedUser) error

// Endpoints contains method-specific handlers without URL knowledge. The router
// package is the sole owner of paths, HTTP methods, and route groups.
//
// 这里是 HTTP 适配层与 router 之间的连接点：每个字段对应一个 HTTP 能力，
// 但不包含 URL、请求方法或路由分组信息。具体业务由下方的领域 endpoint 负责。
type Endpoints struct {
	RequireAuthentication              gin.HandlerFunc
	Health                             gin.HandlerFunc
	SendVerificationCode               gin.HandlerFunc
	RegisterAccount                    gin.HandlerFunc
	LoginWithPassword                  gin.HandlerFunc
	LogoutCurrentSession               gin.HandlerFunc
	ResetLoginPassword                 gin.HandlerFunc
	GetCurrentSession                  gin.HandlerFunc
	ChangeLoginEmail                   gin.HandlerFunc
	ChangeLoginPassword                gin.HandlerFunc
	GetCurrentUserProfile              gin.HandlerFunc
	UpdateCurrentUserProfile           gin.HandlerFunc
	UploadCurrentUserAvatar            gin.HandlerFunc
	UploadCurrentUserProfileBackground gin.HandlerFunc
	GetPublicUserProfile               gin.HandlerFunc
	ListOwnedProjects                  gin.HandlerFunc
	CreateProject                      gin.HandlerFunc
	GetProjectDetail                   gin.HandlerFunc
	UpdateProjectProfile               gin.HandlerFunc
	DeleteProject                      gin.HandlerFunc
	GetProjectExecutionGraph           gin.HandlerFunc
	CreateExecutionNode                gin.HandlerFunc
	ConfirmNodeCompletion              gin.HandlerFunc
	PublishCollaborationCall           gin.HandlerFunc
	OpenPlanningConversation           gin.HandlerFunc
	OpenCompletionReviewConversation   gin.HandlerFunc
	SetProjectReviewAI                 gin.HandlerFunc
	SetProjectSmartContract            gin.HandlerFunc
	ArchiveProject                     gin.HandlerFunc
	RestoreArchivedProject             gin.HandlerFunc
	ListPublicProjects                 gin.HandlerFunc
	GetPublicCollaborationNetwork      gin.HandlerFunc
	GetPublicProjectDetail             gin.HandlerFunc
	ListContributionSourceRecords      gin.HandlerFunc
	ListCurrentUserContributions       gin.HandlerFunc
	GetCollaborationCallDetail         gin.HandlerFunc
	SubmitProjectContribution          gin.HandlerFunc
	ReviewContributionBatch            gin.HandlerFunc
	AdoptReviewedContributions         gin.HandlerFunc
	ListAvailableSmartContracts        gin.HandlerFunc
	CreateSmartContract                gin.HandlerFunc
	ListSmartContractHistory           gin.HandlerFunc
	GetSmartContractDetail             gin.HandlerFunc
	DeleteSmartContract                gin.HandlerFunc
	ListAIKeys                         gin.HandlerFunc
	CreateAIKey                        gin.HandlerFunc
	TestAIKeyConfiguration             gin.HandlerFunc
	VerifySavedAIKey                   gin.HandlerFunc
	DeleteAIKey                        gin.HandlerFunc
	ReviewNodeCompletion               gin.HandlerFunc
	ReviewNodeClarification            gin.HandlerFunc
	ReviewNodeDraft                    gin.HandlerFunc
	GetMonthlyWorkOverview             gin.HandlerFunc
	ReviewDailyActivity                gin.HandlerFunc
	GetAIConversation                  gin.HandlerFunc
	SendConversationMessage            gin.HandlerFunc
	RequestPlanningDraftFreezeReview   gin.HandlerFunc
}

func (s *Server) Endpoints() Endpoints {
	// 组合顺序是：认证/参数适配 -> 领域 endpoint -> 统一响应和错误边界。
	// 所有 endpoint 都通过统一错误包装器接入；需要登录的 endpoint
	// 额外由 withAuthenticatedUserError 注入已认证用户。
	return Endpoints{
		RequireAuthentication:              s.authenticationMiddleware(),
		Health:                             s.withErrorHandler(s.identityEndpoints.Health),
		SendVerificationCode:               s.withErrorHandler(s.identityEndpoints.SendVerificationCode),
		RegisterAccount:                    s.withErrorHandler(s.identityEndpoints.RegisterAccount),
		LoginWithPassword:                  s.withErrorHandler(s.identityEndpoints.LoginWithPassword),
		LogoutCurrentSession:               s.withErrorHandler(s.identityEndpoints.LogoutCurrentSession),
		ResetLoginPassword:                 s.withErrorHandler(s.identityEndpoints.ResetLoginPassword),
		GetCurrentSession:                  s.withErrorHandler(s.identityEndpoints.GetCurrentSession),
		ChangeLoginEmail:                   s.withErrorHandler(s.identityEndpoints.ChangeLoginEmail),
		ChangeLoginPassword:                s.withErrorHandler(s.identityEndpoints.ChangeLoginPassword),
		GetCurrentUserProfile:              s.withAuthenticatedUserError(s.profileEndpoints.GetCurrentUserProfile),
		UpdateCurrentUserProfile:           s.withAuthenticatedUserError(s.profileEndpoints.UpdateCurrentUserProfile),
		UploadCurrentUserAvatar:            s.withAuthenticatedUserError(s.profileEndpoints.UploadCurrentUserAvatar),
		UploadCurrentUserProfileBackground: s.withAuthenticatedUserError(s.profileEndpoints.UploadCurrentUserProfileBackground),
		GetPublicUserProfile:               s.withErrorHandler(s.profileEndpoints.GetPublicUserProfile),
		ListOwnedProjects: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.projectEndpoints.ListOwnedProjects(w, r, user.ID)
		}),
		CreateProject: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.projectEndpoints.CreateProject(w, r, user.ID)
		}),
		GetProjectDetail: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.projectEndpoints.GetProjectDetail(w, r, user.ID)
		}),
		UpdateProjectProfile: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.projectEndpoints.UpdateProjectProfile(w, r, user.ID)
		}),
		DeleteProject: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.projectEndpoints.DeleteProject(w, r, user.ID)
		}),
		GetProjectExecutionGraph: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.projectEndpoints.GetProjectExecutionGraph(w, r, user.ID)
		}),
		CreateExecutionNode: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.executionEndpoints.CreateExecutionNode(w, r, user.ID)
		}),
		ConfirmNodeCompletion: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.executionEndpoints.ConfirmNodeCompletion(w, r, user.ID)
		}),
		PublishCollaborationCall: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.workflowEndpoints.PublishCollaborationCall(w, r, user.ID)
		}),
		OpenPlanningConversation: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.workflowEndpoints.OpenPlanningConversation(w, r, user.ID)
		}),
		OpenCompletionReviewConversation: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.workflowEndpoints.OpenCompletionReviewConversation(w, r, user.ID)
		}),
		SetProjectReviewAI: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.projectEndpoints.SetProjectReviewAI(w, r, user.ID)
		}),
		SetProjectSmartContract: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.projectEndpoints.SetProjectSmartContract(w, r, user.ID)
		}),
		ArchiveProject: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.projectEndpoints.ArchiveProject(w, r, user.ID)
		}),
		RestoreArchivedProject: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.projectEndpoints.RestoreArchivedProject(w, r, user.ID)
		}),
		ListPublicProjects: s.withErrorHandler(s.workflowEndpoints.ListPublicProjects),
		GetPublicCollaborationNetwork: s.withErrorHandler(func(w http.ResponseWriter, r *http.Request) error {
			user, authenticated := s.optionalUser(r)
			var currentUserID *uint64
			if authenticated {
				currentUserID = &user.ID
			}
			return s.networkEndpoints.GetPublicCollaborationNetwork(w, r, currentUserID)
		}),
		GetPublicProjectDetail: s.withErrorHandler(s.workflowEndpoints.GetPublicProjectDetail),
		ListContributionSourceRecords: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.workflowEndpoints.ListContributionSourceRecords(w, r, user.ID)
		}),
		ListCurrentUserContributions: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.workflowEndpoints.ListCurrentUserContributions(w, r, user.ID)
		}),
		GetCollaborationCallDetail: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, _ authenticatedUser) error {
			return s.workflowEndpoints.GetCollaborationCallDetail(w, r)
		}),
		SubmitProjectContribution: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.workflowEndpoints.SubmitProjectContribution(w, r, user.ID)
		}),
		ReviewContributionBatch: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.workflowEndpoints.ReviewContributionBatch(w, r, user.ID)
		}),
		AdoptReviewedContributions: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.workflowEndpoints.AdoptReviewedContributions(w, r, user.ID)
		}),
		ListAvailableSmartContracts: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.projectEndpoints.ListAvailableSmartContracts(w, r, user.ID)
		}),
		CreateSmartContract: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.projectEndpoints.CreateSmartContract(w, r, user.ID)
		}),
		ListSmartContractHistory: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.projectEndpoints.ListSmartContractHistory(w, r, user.ID)
		}),
		GetSmartContractDetail: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.projectEndpoints.GetSmartContractDetail(w, r, user.ID)
		}),
		DeleteSmartContract: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.projectEndpoints.DeleteSmartContract(w, r, user.ID)
		}),
		ListAIKeys: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.aiKeyEndpoints.ListAIKeys(w, r, user.ID)
		}),
		CreateAIKey: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.aiKeyEndpoints.CreateAIKey(w, r, user.ID)
		}),
		TestAIKeyConfiguration: s.withErrorHandler(s.aiKeyEndpoints.TestAIKeyConfiguration),
		VerifySavedAIKey: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.aiKeyEndpoints.VerifySavedAIKey(w, r, user.ID)
		}),
		DeleteAIKey: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.aiKeyEndpoints.DeleteAIKey(w, r, user.ID)
		}),
		ReviewNodeCompletion: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.workflowEndpoints.ReviewNodeCompletion(w, r, user.ID)
		}),
		ReviewNodeClarification: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.workflowEndpoints.ReviewNodeClarification(w, r, user.ID)
		}),
		ReviewNodeDraft: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.workflowEndpoints.ReviewNodeDraft(w, r, user.ID)
		}),
		GetMonthlyWorkOverview: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.workflowEndpoints.GetMonthlyWorkOverview(w, r, user.ID)
		}),
		ReviewDailyActivity: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.workflowEndpoints.ReviewDailyActivity(w, r, user.ID)
		}),
		GetAIConversation: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.workflowEndpoints.GetAIConversation(w, r, user.ID)
		}),
		SendConversationMessage: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.workflowEndpoints.SendConversationMessage(w, r, user.ID)
		}),
		RequestPlanningDraftFreezeReview: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.workflowEndpoints.RequestPlanningDraftFreezeReview(w, r, user.ID)
		}),
	}
}

func (s *Server) withErrorHandler(handler errorHandler) gin.HandlerFunc {
	return func(context *gin.Context) {
		// endpoint 只返回业务错误，不直接决定错误 JSON 的格式和状态码。
		// ErrorBoundary 会读取 context.Errors 并统一调用 response.WriteFault。
		if err := handler(context.Writer, context.Request); err != nil {
			_ = context.Error(err)
			context.Abort()
		}
	}
}

func (s *Server) withAuthenticatedUserError(handler authenticatedErrorHandler) gin.HandlerFunc {
	return func(context *gin.Context) {
		// authenticationMiddleware 已经验证 token 并把用户放入 Request Context；
		// 这个包装器只负责取出用户，不重复执行认证。
		user, ok := userFromContext(context.Request)
		if !ok {
			_ = context.Error(fault.New(fault.Internal, "认证上下文缺失"))
			context.Abort()
			return
		}
		// 业务 endpoint 返回 error，由统一错误边界决定响应内容。
		if err := handler(context.Writer, context.Request, user); err != nil {
			_ = context.Error(err)
			context.Abort()
		}
	}
}
