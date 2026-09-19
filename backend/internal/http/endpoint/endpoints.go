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

type faultCapturingWriter struct {
	http.ResponseWriter
	err error
}

func (writer *faultCapturingWriter) captureFault(err error) {
	if writer.err == nil {
		writer.err = err
	}
}

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
		Health:                s.withErrorHandler(s.identityEndpoints.Health),
		SendCode:              s.withErrorHandler(s.identityEndpoints.SendCode),
		Register:              s.withErrorHandler(s.identityEndpoints.Register),
		Login:                 s.withErrorHandler(s.identityEndpoints.Login),
		Logout:                s.withErrorHandler(s.identityEndpoints.Logout),
		ResetPassword:         s.withErrorHandler(s.identityEndpoints.ResetPassword),
		CurrentAuth:           s.withErrorHandler(s.identityEndpoints.Me),
		ChangeEmail:           s.withErrorHandler(s.identityEndpoints.ChangeEmail),
		ChangePassword:        s.withErrorHandler(s.identityEndpoints.ChangePassword),
		CurrentUser:           s.withLegacyHandler(s.profileEndpoints.CurrentUser),
		UpdateCurrentUser: s.withAuthenticatedUser(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) {
			s.profileEndpoints.UpdateCurrentUser(w, r, user)
		}),
		UploadAvatar:     s.withLegacyHandler(s.profileEndpoints.Avatar),
		UploadBackground: s.withLegacyHandler(s.profileEndpoints.ProfileBackground),
		ListProjects: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.projectEndpoints.List(w, r, user.ID)
		}),
		CreateProject: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.projectEndpoints.Create(w, r, user.ID)
		}),
		GetProject: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.projectEndpoints.Get(w, r, user.ID, requestParameter(r, "projectID"))
		}),
		UpdateProject: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.projectEndpoints.Update(w, r, user.ID, requestParameter(r, "projectID"))
		}),
		DeleteProject: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.projectEndpoints.Delete(w, r, user.ID, requestParameter(r, "projectID"))
		}),
		GetProjectGraph: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.projectEndpoints.Graph(w, r, user.ID, requestParameter(r, "projectID"))
		}),
		CreateNode: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.workflowEndpoints.CreateExecutionNode(w, r, user.ID, requestParameter(r, "projectID"))
		}),
		LockNode: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.workflowEndpoints.LockExecutionNode(w, r, user.ID, requestParameter(r, "projectID"), requestParameter(r, "nodeID"))
		}),
		CreateCall: s.withAuthenticatedUser(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) {
			s.workflowEndpoints.CreateCollaborationCall(w, r, user.ID, requestParameter(r, "projectID"))
		}),
		CreatePlanningChat: s.withAuthenticatedUser(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) {
			s.workflowEndpoints.CreatePlanningConversation(w, r, user.ID, requestParameter(r, "projectID"))
		}),
		CreateCompletionChat: s.withAuthenticatedUser(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) {
			s.workflowEndpoints.CreateCompletionConversation(w, r, user.ID, requestParameter(r, "projectID"), requestParameter(r, "nodeID"))
		}),
		SetProjectAIKey: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.projectEndpoints.SetAIKey(w, r, user.ID, requestParameter(r, "projectID"))
		}),
		SetProjectContract: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.projectEndpoints.SetContract(w, r, user.ID, requestParameter(r, "projectID"))
		}),
		ArchiveProject: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.projectEndpoints.Archive(w, r, user.ID, requestParameter(r, "projectID"))
		}),
		UnarchiveProject: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.projectEndpoints.Unarchive(w, r, user.ID, requestParameter(r, "projectID"))
		}),
		ExploreProjects: s.withLegacyHandler(s.workflowEndpoints.ExploreProjects),
		ExploreNetwork: s.withErrorHandler(func(w http.ResponseWriter, r *http.Request) error {
			user, authenticated := s.optionalUser(r)
			var currentUserID *uint64
			if authenticated {
				currentUserID = &user.ID
			}
			return s.networkEndpoints.Explore(w, r, currentUserID)
		}),
		ExploreProject: s.withLegacyHandler(func(w http.ResponseWriter, r *http.Request) {
			s.workflowEndpoints.ExploreProject(w, r, requestParameter(r, "projectID"))
		}),
		ContributionSources: s.withLegacyHandler(s.workflowEndpoints.ContributionSources),
		MyContributions:     s.withLegacyHandler(s.workflowEndpoints.MyContributions),
		GetCall: s.withAuthenticatedUser(func(w http.ResponseWriter, r *http.Request, _ authenticatedUser) {
			s.workflowEndpoints.GetCollaborationCall(w, r, requestParameter(r, "callID"))
		}),
		SubmitContribution: s.withAuthenticatedUser(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) {
			s.workflowEndpoints.SubmitContribution(w, r, user.ID, requestParameter(r, "callID"))
		}),
		ReviewContributions: s.withAuthenticatedUser(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) {
			s.workflowEndpoints.ReviewContributions(w, r, user.ID, requestParameter(r, "callID"))
		}),
		AdoptReview: s.withAuthenticatedUser(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) {
			s.workflowEndpoints.AdoptReview(w, r, user.ID, requestParameter(r, "batchID"))
		}),
		ListContracts: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.projectEndpoints.ListContracts(w, r, user.ID)
		}),
		CreateContract: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.projectEndpoints.CreateContract(w, r, user.ID)
		}),
		ListContractHistory: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.projectEndpoints.ContractHistory(w, r, user.ID)
		}),
		GetContract: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.projectEndpoints.GetContract(w, r, user.ID, requestParameter(r, "contractID"))
		}),
		DeleteContract: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.projectEndpoints.DeleteContract(w, r, user.ID, requestParameter(r, "contractID"))
		}),
		ListAIKeys: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.aiKeyEndpoints.List(w, r, user.ID)
		}),
		CreateAIKey: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.aiKeyEndpoints.Create(w, r, user.ID)
		}),
		TestAIKey: s.withErrorHandler(s.aiKeyEndpoints.Test),
		VerifyAIKey: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.aiKeyEndpoints.Verify(w, r, user.ID, requestParameter(r, "keyID"))
		}),
		DeleteAIKey: s.withAuthenticatedUserError(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) error {
			return s.aiKeyEndpoints.Delete(w, r, user.ID, requestParameter(r, "keyID"))
		}),
		ReviewNode:        s.withLegacyHandler(s.workflowEndpoints.ReviewNode),
		ClarifyNodeReview: s.withLegacyHandler(s.workflowEndpoints.ClarifyNodeReview),
		ReviewNodeDraft:   s.withLegacyHandler(s.workflowEndpoints.ReviewNodeDraft),
		WorkOverview:      s.withLegacyHandler(s.workflowEndpoints.WorkOverview),
		ReviewWorkDay: s.withAuthenticatedUser(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) {
			s.workflowEndpoints.ReviewWorkDay(w, r, user.ID, requestParameter(r, "date"))
		}),
		GetConversation: s.withAuthenticatedUser(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) {
			s.workflowEndpoints.GetConversation(w, r, user.ID, requestParameter(r, "conversationID"))
		}),
		SendMessage: s.withAuthenticatedUser(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) {
			s.workflowEndpoints.SendConversationMessage(w, r, user.ID, requestParameter(r, "conversationID"), false)
		}),
		FreezeReview: s.withAuthenticatedUser(func(w http.ResponseWriter, r *http.Request, user authenticatedUser) {
			s.workflowEndpoints.SendConversationMessage(w, r, user.ID, requestParameter(r, "conversationID"), true)
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
