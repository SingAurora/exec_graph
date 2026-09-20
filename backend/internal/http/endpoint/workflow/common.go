package workflow

import (
	"database/sql"
	"net/http"

	applicationaikey "github.com/singaurora/exec-graph/backend/internal/application/aikey"
	applicationcollaboration "github.com/singaurora/exec-graph/backend/internal/application/collaboration"
	applicationidentity "github.com/singaurora/exec-graph/backend/internal/application/identity"
	applicationproject "github.com/singaurora/exec-graph/backend/internal/application/project"
	applicationworkoverview "github.com/singaurora/exec-graph/backend/internal/application/workoverview"
	endpointcommon "github.com/singaurora/exec-graph/backend/internal/http/endpoint/common"
	conversationpersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/conversation"
	reviewpersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/review"
)

type RequireUserFunc func(http.ResponseWriter, *http.Request) (applicationidentity.User, bool)

// Handler 聚合旧执行流接口。这里先把高度互相依赖的规划、审查、协作、
// 工作总览放在同一领域包中，后续 application 服务继续成熟后再细分。
type Handler struct {
	project         *applicationproject.Service
	collaboration   *applicationcollaboration.Service
	aiKey           *applicationaikey.Service
	reviews         *reviewpersistence.Repository
	conversations   *conversationpersistence.Repository
	workOverview    *applicationworkoverview.Service
	requireUserFunc RequireUserFunc
}

type Dependencies struct {
	Project       *applicationproject.Service
	Collaboration *applicationcollaboration.Service
	AIKey         *applicationaikey.Service
	Reviews       *reviewpersistence.Repository
	Conversations *conversationpersistence.Repository
	WorkOverview  *applicationworkoverview.Service
	RequireUser   RequireUserFunc
}

func New(dependencies Dependencies) *Handler {
	return &Handler{
		project:         dependencies.Project,
		collaboration:   dependencies.Collaboration,
		aiKey:           dependencies.AIKey,
		reviews:         dependencies.Reviews,
		conversations:   dependencies.Conversations,
		workOverview:    dependencies.WorkOverview,
		requireUserFunc: dependencies.RequireUser,
	}
}

func (h *Handler) requireUser(w http.ResponseWriter, r *http.Request) (applicationidentity.User, bool) {
	return h.requireUserFunc(w, r)
}

func (h *Handler) CreateCollaborationCall(w http.ResponseWriter, r *http.Request, userID uint64, projectID string) {
	h.handleProjectCollaborationCalls(w, r, userID, projectID)
}

func (h *Handler) ExploreProjects(w http.ResponseWriter, r *http.Request) {
	h.handleExploreProjects(w, r)
}

func (h *Handler) ExploreProject(w http.ResponseWriter, r *http.Request, projectID string) {
	h.handleExploreProject(w, r, projectID)
}

func (h *Handler) ContributionSources(w http.ResponseWriter, r *http.Request) {
	h.handleContributionSources(w, r)
}

func (h *Handler) MyContributions(w http.ResponseWriter, r *http.Request) {
	h.handleMyContributions(w, r)
}

func (h *Handler) GetCollaborationCall(w http.ResponseWriter, r *http.Request, callID string) {
	h.getCollaborationCall(w, r, callID)
}

func (h *Handler) SubmitContribution(w http.ResponseWriter, r *http.Request, userID uint64, callID string) {
	h.createCollaborationSubmission(w, r, userID, callID)
}

func (h *Handler) ReviewContributions(w http.ResponseWriter, r *http.Request, userID uint64, callID string) {
	h.reviewCollaborationSubmissions(w, r, userID, callID)
}

func (h *Handler) AdoptReview(w http.ResponseWriter, r *http.Request, userID uint64, batchID string) {
	h.adoptCollaborationReview(w, r, userID, batchID)
}

func (h *Handler) ReviewNode(w http.ResponseWriter, r *http.Request) {
	h.reviewExecutionNode(w, r)
}

func (h *Handler) ClarifyNodeReview(w http.ResponseWriter, r *http.Request) {
	h.reviewExecutionNodeClarification(w, r)
}

func (h *Handler) ReviewNodeDraft(w http.ResponseWriter, r *http.Request) {
	h.reviewNodeDraft(w, r)
}

func (h *Handler) WorkOverview(w http.ResponseWriter, r *http.Request) {
	h.handleWorkOverview(w, r)
}

func (h *Handler) ReviewWorkDay(w http.ResponseWriter, r *http.Request, userID uint64, dateValue string) {
	h.handleDailyWorkReview(w, r, userID, dateValue)
}

func (h *Handler) CreatePlanningConversation(w http.ResponseWriter, r *http.Request, userID uint64, projectID string) {
	h.createPlanningConversation(w, r, userID, projectID)
}

func (h *Handler) CreateCompletionConversation(w http.ResponseWriter, r *http.Request, userID uint64, projectID, nodeID string) {
	h.createCompletionConversation(w, r, userID, projectID, nodeID)
}

func (h *Handler) GetConversation(w http.ResponseWriter, r *http.Request, userID uint64, conversationID string) {
	h.getConversation(w, r, userID, conversationID)
}

func (h *Handler) SendConversationMessage(w http.ResponseWriter, r *http.Request, userID uint64, conversationID string, freezeReview bool) {
	h.sendConversationMessage(w, r, userID, conversationID, freezeReview)
}

func decodeJSON(r *http.Request, target any) error { return endpointcommon.DecodeJSON(r, target) }
func bindJSON(w http.ResponseWriter, r *http.Request, target any) bool {
	return endpointcommon.BindJSON(w, r, target)
}
func writeJSON(w http.ResponseWriter, status int, value any) {
	endpointcommon.WriteJSON(w, status, value)
}
func writeError(w http.ResponseWriter, status int, message string) {
	endpointcommon.WriteError(w, status, message)
}
func newOpaqueID(kind string) (string, error) { return endpointcommon.NewOpaqueID(kind) }
func jsonValue(value any) (string, error)     { return endpointcommon.JSONValue(value) }
func nullableString(value sql.NullString) *string {
	return endpointcommon.NullableString(value)
}
func decodeOptionalJSON(value sql.NullString) any {
	return endpointcommon.DecodeOptionalJSON(value)
}
func decodeJSONValue(value string, fallback any) any {
	return endpointcommon.DecodeJSONValue(value, fallback)
}
func uniqueNonEmpty(values []string) []string { return endpointcommon.UniqueNonEmpty(values) }
