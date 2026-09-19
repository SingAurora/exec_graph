package endpoint

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	httprequest "github.com/singaurora/exec-graph/backend/internal/http/request"
)

type authenticatedHandler func(http.ResponseWriter, *http.Request, authenticatedUser)

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
		Health:                gin.WrapF(s.health),
		SendCode:              gin.WrapF(s.sendCode),
		Register:              gin.WrapF(s.register),
		Login:                 gin.WrapF(s.login),
		Logout:                gin.WrapF(s.logout),
		ResetPassword:         gin.WrapF(s.resetPassword),
		CurrentAuth:           gin.WrapF(s.me),
		ChangeEmail:           gin.WrapF(s.changeEmail),
		ChangePassword:        gin.WrapF(s.changePassword),
		CurrentUser:           gin.WrapF(s.handleCurrentUser),
		UpdateCurrentUser: s.withAuthenticatedUser(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) {
			s.updateCurrentUser(w, r, user)
		}),
		UploadAvatar:     gin.WrapF(s.handleAvatar),
		UploadBackground: gin.WrapF(s.handleProfileBackground),
		ListProjects: s.withAuthenticatedUser(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) {
			s.listProjects(w, r, user.ID)
		}),
		CreateProject: s.withAuthenticatedUser(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) {
			s.createProject(w, r, user.ID)
		}),
		GetProject: s.withAuthenticatedUser(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) {
			s.getProject(w, r, user.ID, requestParameter(r, "projectID"))
		}),
		UpdateProject: s.withAuthenticatedUser(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) {
			s.updateProject(w, r, user.ID, requestParameter(r, "projectID"))
		}),
		DeleteProject: s.withAuthenticatedUser(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) {
			s.deleteProject(w, r, user.ID, requestParameter(r, "projectID"))
		}),
		GetProjectGraph: s.withAuthenticatedUser(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) {
			s.getProjectGraph(w, r, user.ID, requestParameter(r, "projectID"))
		}),
		CreateNode: s.withAuthenticatedUser(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) {
			s.createExecutionNode(w, r, user.ID, requestParameter(r, "projectID"))
		}),
		LockNode: s.withAuthenticatedUser(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) {
			s.lockExecutionNode(w, r, user.ID, requestParameter(r, "projectID"), requestParameter(r, "nodeID"))
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
		SetProjectAIKey: s.withAuthenticatedUser(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) {
			s.setProjectAIKey(w, r, user.ID, requestParameter(r, "projectID"))
		}),
		SetProjectContract: s.withAuthenticatedUser(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) {
			s.setProjectSmartContract(w, r, user.ID, requestParameter(r, "projectID"))
		}),
		ArchiveProject: s.withAuthenticatedUser(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) {
			s.archiveProject(w, r, user.ID, requestParameter(r, "projectID"))
		}),
		UnarchiveProject: s.withAuthenticatedUser(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) {
			s.unarchiveProject(w, r, user.ID, requestParameter(r, "projectID"))
		}),
		ExploreProjects: gin.WrapF(s.handleExploreProjects),
		ExploreNetwork:  gin.WrapF(s.handleExploreNetwork),
		ExploreProject: func(context *gin.Context) {
			s.handleExploreProject(context.Writer, context.Request, requestParameter(context.Request, "projectID"))
		},
		ContributionSources: gin.WrapF(s.handleContributionSources),
		MyContributions:     gin.WrapF(s.handleMyContributions),
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
		ListContracts: s.withAuthenticatedUser(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) {
			s.listSmartContracts(w, r, user.ID)
		}),
		CreateContract: s.withAuthenticatedUser(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) {
			s.createSmartContractApplication(w, r, user.ID)
		}),
		ListContractHistory: s.withAuthenticatedUser(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) {
			s.listSmartContractEventsApplication(w, r, user.ID)
		}),
		GetContract: s.withAuthenticatedUser(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) {
			s.getSmartContract(w, r, user.ID, requestParameter(r, "contractID"))
		}),
		DeleteContract: s.withAuthenticatedUser(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) {
			s.deleteSmartContractApplication(w, r, user.ID, requestParameter(r, "contractID"))
		}),
		ListAIKeys: s.withAuthenticatedUser(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) {
			s.listAIKeysApplication(w, r, user.ID)
		}),
		CreateAIKey: s.withAuthenticatedUser(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) {
			s.createAIKeyApplication(w, r, user.ID)
		}),
		TestAIKey: gin.WrapF(s.testAIKeyApplication),
		VerifyAIKey: s.withAuthenticatedUser(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) {
			s.verifyAIKeyApplication(w, r, user.ID, requestParameter(r, "keyID"))
		}),
		DeleteAIKey: s.withAuthenticatedUser(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) {
			s.deleteAIKeyApplication(w, r, user.ID, requestParameter(r, "keyID"))
		}),
		ReviewNode:        gin.WrapF(s.reviewExecutionNode),
		ClarifyNodeReview: gin.WrapF(s.reviewExecutionNodeClarification),
		ReviewNodeDraft:   gin.WrapF(s.reviewNodeDraft),
		WorkOverview:      gin.WrapF(s.handleWorkOverview),
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

func (s *Server) withAuthenticatedUser(handler authenticatedHandler) gin.HandlerFunc {
	return func(context *gin.Context) {
		user, ok := userFromContext(context.Request)
		if !ok {
			writeError(context.Writer, http.StatusInternalServerError, "认证上下文缺失")
			context.Abort()
			return
		}
		handler(context.Writer, context.Request, user)
	}
}

func requestParameter(r *http.Request, name string) string {
	key := strings.TrimSuffix(name, "ID") + "Id"
	value, _ := httprequest.String(r, key)
	return value
}
