package endpoint

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	httprequest "github.com/singaurora/exec-graph/backend/internal/http/request"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
)

type authenticatedHandler func(http.ResponseWriter, *http.Request, authenticatedUser)
type errorHandler func(http.ResponseWriter, *http.Request) error
type authenticatedErrorHandler func(http.ResponseWriter, *http.Request, authenticatedUser) error

// Endpoints contains method-specific handlers without URL knowledge. The router
// package is the sole owner of paths, HTTP methods, and route groups.
type Endpoints struct {
	RequireAuthentication gin.HandlerFunc
	Health                gin.HandlerFunc
	SendCode              gin.HandlerFunc
	Register              gin.HandlerFunc
	Login                 gin.HandlerFunc
	Logout                gin.HandlerFunc
	ResetPassword         gin.HandlerFunc
	CurrentAuth           gin.HandlerFunc
	ChangeEmail           gin.HandlerFunc
	ChangePassword        gin.HandlerFunc
	CurrentUser           gin.HandlerFunc
	UpdateCurrentUser     gin.HandlerFunc
	UploadAvatar          gin.HandlerFunc
	UploadBackground      gin.HandlerFunc
	ListProjects          gin.HandlerFunc
	CreateProject         gin.HandlerFunc
	GetProject            gin.HandlerFunc
	UpdateProject         gin.HandlerFunc
	DeleteProject         gin.HandlerFunc
	GetProjectGraph       gin.HandlerFunc
	CreateNode            gin.HandlerFunc
	LockNode              gin.HandlerFunc
	CreateCall            gin.HandlerFunc
	CreatePlanningChat    gin.HandlerFunc
	CreateCompletionChat  gin.HandlerFunc
	SetProjectAIKey       gin.HandlerFunc
	SetProjectContract    gin.HandlerFunc
	ArchiveProject        gin.HandlerFunc
	UnarchiveProject      gin.HandlerFunc
	ExploreProjects       gin.HandlerFunc
	ExploreNetwork        gin.HandlerFunc
	ExploreProject        gin.HandlerFunc
	ContributionSources   gin.HandlerFunc
	MyContributions       gin.HandlerFunc
	GetCall               gin.HandlerFunc
	SubmitContribution    gin.HandlerFunc
	ReviewContributions   gin.HandlerFunc
	AdoptReview           gin.HandlerFunc
	ListContracts         gin.HandlerFunc
	CreateContract        gin.HandlerFunc
	ListContractHistory   gin.HandlerFunc
	GetContract           gin.HandlerFunc
	DeleteContract        gin.HandlerFunc
	ListAIKeys            gin.HandlerFunc
	CreateAIKey           gin.HandlerFunc
	TestAIKey             gin.HandlerFunc
	VerifyAIKey           gin.HandlerFunc
	DeleteAIKey           gin.HandlerFunc
	ReviewNode            gin.HandlerFunc
	ClarifyNodeReview     gin.HandlerFunc
	ReviewNodeDraft       gin.HandlerFunc
	WorkOverview          gin.HandlerFunc
	ReviewWorkDay         gin.HandlerFunc
	GetConversation       gin.HandlerFunc
	SendMessage           gin.HandlerFunc
	FreezeReview          gin.HandlerFunc
}

func (s *Server) Endpoints() Endpoints {
	return Endpoints{
		RequireAuthentication: s.authenticationMiddleware(),
		Health:                s.withErrorHandler(s.health),
		SendCode:              s.withErrorHandler(s.sendCode),
		Register:              s.withErrorHandler(s.register),
		Login:                 s.withErrorHandler(s.login),
		Logout:                s.withErrorHandler(s.logout),
		ResetPassword:         s.withErrorHandler(s.resetPassword),
		CurrentAuth:           s.withErrorHandler(s.me),
		ChangeEmail:           s.withErrorHandler(s.changeEmail),
		ChangePassword:        s.withErrorHandler(s.changePassword),
		CurrentUser:           s.withLegacyHandler(s.handleCurrentUser),
		UpdateCurrentUser: s.withAuthenticatedUser(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) {
			s.updateCurrentUser(w, r, user)
		}),
		UploadAvatar:     s.withLegacyHandler(s.handleAvatar),
		UploadBackground: s.withLegacyHandler(s.handleProfileBackground),
		ListProjects: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.listProjects(w, r, user.ID)
		}),
		CreateProject: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.createProject(w, r, user.ID)
		}),
		GetProject: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.getProject(w, r, user.ID, requestParameter(r, "projectID"))
		}),
		UpdateProject: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.updateProject(w, r, user.ID, requestParameter(r, "projectID"))
		}),
		DeleteProject: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.deleteProject(w, r, user.ID, requestParameter(r, "projectID"))
		}),
		GetProjectGraph: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.getProjectGraph(w, r, user.ID, requestParameter(r, "projectID"))
		}),
		CreateNode: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.createExecutionNode(w, r, user.ID, requestParameter(r, "projectID"))
		}),
		LockNode: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.lockExecutionNode(w, r, user.ID, requestParameter(r, "projectID"), requestParameter(r, "nodeID"))
		}),
		CreateCall: s.withAuthenticatedUser(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) {
			s.handleProjectCollaborationCalls(w, r, user.ID, requestParameter(r, "projectID"))
		}),
		CreatePlanningChat: s.withAuthenticatedUser(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) {
			s.createPlanningConversation(w, r, user.ID, requestParameter(r, "projectID"))
		}),
		CreateCompletionChat: s.withAuthenticatedUser(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) {
			s.createCompletionConversation(w, r, user.ID, requestParameter(r, "projectID"), requestParameter(r, "nodeID"))
		}),
		SetProjectAIKey: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.setProjectAIKey(w, r, user.ID, requestParameter(r, "projectID"))
		}),
		SetProjectContract: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.setProjectSmartContract(w, r, user.ID, requestParameter(r, "projectID"))
		}),
		ArchiveProject: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.archiveProject(w, r, user.ID, requestParameter(r, "projectID"))
		}),
		UnarchiveProject: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.unarchiveProject(w, r, user.ID, requestParameter(r, "projectID"))
		}),
		ExploreProjects: s.withLegacyHandler(s.handleExploreProjects),
		ExploreNetwork:  s.withLegacyHandler(s.handleExploreNetwork),
		ExploreProject: s.withLegacyHandler(func(w http.ResponseWriter, r *http.Request) {
			s.handleExploreProject(w, r, requestParameter(r, "projectID"))
		}),
		ContributionSources: s.withLegacyHandler(s.handleContributionSources),
		MyContributions:     s.withLegacyHandler(s.handleMyContributions),
		GetCall: s.withAuthenticatedUser(func(w http.ResponseWriter, r *http.Request, _ authenticatedUser) {
			s.getCollaborationCall(w, r, requestParameter(r, "callID"))
		}),
		SubmitContribution: s.withAuthenticatedUser(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) {
			s.createCollaborationSubmission(w, r, user.ID, requestParameter(r, "callID"))
		}),
		ReviewContributions: s.withAuthenticatedUser(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) {
			s.reviewCollaborationSubmissions(w, r, user.ID, requestParameter(r, "callID"))
		}),
		AdoptReview: s.withAuthenticatedUser(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) {
			s.adoptCollaborationReview(w, r, user.ID, requestParameter(r, "batchID"))
		}),
		ListContracts: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.listSmartContracts(w, r, user.ID)
		}),
		CreateContract: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.createSmartContractApplication(w, r, user.ID)
		}),
		ListContractHistory: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.listSmartContractEventsApplication(w, r, user.ID)
		}),
		GetContract: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.getSmartContract(w, r, user.ID, requestParameter(r, "contractID"))
		}),
		DeleteContract: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.deleteSmartContractApplication(w, r, user.ID, requestParameter(r, "contractID"))
		}),
		ListAIKeys: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.listAIKeysApplication(w, r, user.ID)
		}),
		CreateAIKey: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.createAIKeyApplication(w, r, user.ID)
		}),
		TestAIKey: s.withErrorHandler(s.testAIKeyApplication),
		VerifyAIKey: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.verifyAIKeyApplication(w, r, user.ID, requestParameter(r, "keyID"))
		}),
		DeleteAIKey: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.deleteAIKeyApplication(w, r, user.ID, requestParameter(r, "keyID"))
		}),
		ReviewNode:        s.withLegacyHandler(s.reviewExecutionNode),
		ClarifyNodeReview: s.withLegacyHandler(s.reviewExecutionNodeClarification),
		ReviewNodeDraft:   s.withLegacyHandler(s.reviewNodeDraft),
		WorkOverview:      s.withLegacyHandler(s.handleWorkOverview),
		ReviewWorkDay: s.withAuthenticatedUser(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) {
			s.handleDailyWorkReview(w, r, user.ID, requestParameter(r, "date"))
		}),
		GetConversation: s.withAuthenticatedUser(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) {
			s.getConversation(w, r, user.ID, requestParameter(r, "conversationID"))
		}),
		SendMessage: s.withAuthenticatedUser(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) {
			s.sendConversationMessage(w, r, user.ID, requestParameter(r, "conversationID"), false)
		}),
		FreezeReview: s.withAuthenticatedUser(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) {
			s.sendConversationMessage(w, r, user.ID, requestParameter(r, "conversationID"), true)
		}),
	}
}

func (s *Server) withErrorHandler(handler errorHandler) gin.HandlerFunc {
	return func(context *gin.Context) {
		if err := handler(context.Writer, context.Request); err != nil {
			_ = context.Error(err)
			context.Abort()
		}
	}
}

func (s *Server) withLegacyHandler(handler http.HandlerFunc) gin.HandlerFunc {
	return func(context *gin.Context) {
		writer := &faultCapturingWriter{ResponseWriter: context.Writer}
		handler(writer, context.Request)
		if writer.err != nil {
			_ = context.Error(writer.err)
			context.Abort()
		}
	}
}

func (s *Server) withAuthenticatedUserError(handler authenticatedErrorHandler) gin.HandlerFunc {
	return func(context *gin.Context) {
		user, ok := userFromContext(context.Request)
		if !ok {
			_ = context.Error(fault.New(fault.Internal, "认证上下文缺失"))
			context.Abort()
			return
		}
		if err := handler(context.Writer, context.Request, user); err != nil {
			_ = context.Error(err)
			context.Abort()
		}
	}
}

func (s *Server) withAuthenticatedUser(handler authenticatedHandler) gin.HandlerFunc {
	return func(context *gin.Context) {
		user, ok := userFromContext(context.Request)
		if !ok {
			_ = context.Error(fault.New(fault.Internal, "认证上下文缺失"))
			context.Abort()
			return
		}
		writer := &faultCapturingWriter{ResponseWriter: context.Writer}
		handler(writer, context.Request, user)
		if writer.err != nil {
			_ = context.Error(writer.err)
			context.Abort()
		}
	}
}

func requestParameter(r *http.Request, name string) string {
	key := strings.TrimSuffix(name, "ID") + "Id"
	value, _ := httprequest.String(r, key)
	return value
}
