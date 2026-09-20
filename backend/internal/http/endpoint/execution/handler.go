// Package execution adapts execution-node lifecycle use cases to HTTP.
package execution

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	applicationconversation "github.com/singaurora/exec-graph/backend/internal/application/conversation"
	applicationproject "github.com/singaurora/exec-graph/backend/internal/application/project"
	endpointcommon "github.com/singaurora/exec-graph/backend/internal/http/endpoint/common"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
)

// Handler converts execution-node HTTP requests into project application use cases.
type Handler struct {
	project      *applicationproject.Service
	conversation *applicationconversation.Service
}

type Dependencies struct {
	Project      *applicationproject.Service
	Conversation *applicationconversation.Service
}

func New(dependencies Dependencies) *Handler {
	return &Handler{project: dependencies.Project, conversation: dependencies.Conversation}
}

type criterionRequest struct {
	ID               string `json:"id"`
	Text             string `json:"text"`
	RequiredEvidence string `json:"requiredEvidence"`
}

// draftReviewRequest keeps the persisted planning-review payload compatible
// while exposing only the fields needed to create a node.
type draftReviewRequest struct {
	ID                  string    `json:"uuid"`
	Verdict             string    `json:"verdict"`
	Summary             string    `json:"summary"`
	MissingRequirements []string  `json:"missingRequirements"`
	CreatedAt           time.Time `json:"createdAt"`
	AIConfig            struct {
		KeyUUID  string `json:"keyUuid"`
		Label    string `json:"label"`
		Provider string `json:"provider"`
		Model    string `json:"model"`
		BaseURL  string `json:"baseUrl"`
	} `json:"aiConfig"`
}

type createNodeRequest struct {
	ProjectUUID              string             `json:"projectUuid"`
	Draft                    string             `json:"draft"`
	DraftReview              draftReviewRequest `json:"draftReview"`
	Title                    string             `json:"title"`
	VerifiableGoal           string             `json:"verifiableGoal"`
	AcceptanceCriteria       []criterionRequest `json:"acceptanceCriteria"`
	EvidenceRequirement      string             `json:"evidenceRequirement"`
	ParentContractUUID       string             `json:"parentContractUuid"`
	SourceContractUUIDs      []string           `json:"sourceContractUuids"`
	BranchUUID               string             `json:"branchUuid"`
	Fork                     bool               `json:"fork"`
	SupplementOfContractUUID string             `json:"supplementOfContractUuid"`
	RetryOfContractUUID      string             `json:"retryOfContractUuid"`
	Closure                  bool               `json:"closure"`
	PlanningConversationUUID string             `json:"planningConversationUuid"`
}

type confirmNodeCompletionRequest struct {
	ProjectUUID string `json:"projectUuid"`
	NodeUUID    string `json:"nodeUuid"`
}

// CreateNode creates a reviewed execution node for the supplied project.
// CreateExecutionNode 使用已通过审查的规划草案创建冻结执行节点。
func (h *Handler) CreateExecutionNode(w http.ResponseWriter, r *http.Request, userID uint64) error {
	var request createNodeRequest
	if err := endpointcommon.DecodeJSON(r, &request); err != nil {
		return err
	}
	projectUUID := strings.TrimSpace(request.ProjectUUID)
	if projectUUID == "" {
		return fault.New(fault.InvalidRequest, "缺少项目 UUID")
	}
	criteria := make([]applicationproject.Criterion, 0, len(request.AcceptanceCriteria))
	for _, item := range request.AcceptanceCriteria {
		criteria = append(criteria, applicationproject.Criterion{ID: item.ID, Text: item.Text, RequiredEvidence: item.RequiredEvidence})
	}
	result, err := h.project.CreateExecutionNode(r.Context(), applicationproject.CreateNodeInput{
		OwnerID: userID, ProjectID: projectUUID, Draft: request.Draft, DraftReview: request.DraftReview,
		DraftReviewVerdict: request.DraftReview.Verdict, DraftReviewKeyID: request.DraftReview.AIConfig.KeyUUID,
		Title: request.Title, VerifiableGoal: request.VerifiableGoal, AcceptanceCriteria: criteria,
		EvidenceRequirement: request.EvidenceRequirement, ParentContractID: request.ParentContractUUID,
		SourceContractIDs: request.SourceContractUUIDs, BranchID: request.BranchUUID, Fork: request.Fork,
		SupplementOfNodeID: request.SupplementOfContractUUID, RetryOfContractID: request.RetryOfContractUUID,
		Closure: request.Closure, PlanningConversationID: request.PlanningConversationUUID,
	})
	if errors.Is(err, applicationproject.ErrNotFound) {
		return fault.New(fault.NotFound, "项目不存在")
	}
	var validation *applicationproject.ValidationError
	if errors.As(err, &validation) {
		return fault.New(fault.InvalidRequest, validation.Message)
	}
	if err != nil {
		return fault.Wrap(fault.Internal, "创建节点失败", err)
	}
	if strings.TrimSpace(request.PlanningConversationUUID) != "" {
		h.copyPlanningConversationToNodeMessages(r.Context(), request.PlanningConversationUUID, result.NodeID, userID)
	}
	endpointcommon.WriteJSON(w, http.StatusCreated, result.State)
	return nil
}

// ConfirmNodeCompletion 确认节点审查结论并写入不可变的完成记录。
func (h *Handler) ConfirmNodeCompletion(w http.ResponseWriter, r *http.Request, userID uint64) error {
	var request confirmNodeCompletionRequest
	if err := endpointcommon.DecodeJSON(r, &request); err != nil {
		return err
	}
	projectUUID := strings.TrimSpace(request.ProjectUUID)
	nodeUUID := strings.TrimSpace(request.NodeUUID)
	if projectUUID == "" || nodeUUID == "" {
		return fault.New(fault.InvalidRequest, "缺少项目或节点 UUID")
	}
	state, err := h.project.ConfirmNodeCompletion(r.Context(), userID, projectUUID, nodeUUID)
	if errors.Is(err, applicationproject.ErrNotFound) {
		return fault.New(fault.NotFound, "项目或节点不存在")
	}
	var validation *applicationproject.ValidationError
	if errors.As(err, &validation) {
		return fault.New(fault.InvalidRequest, validation.Message)
	}
	if err != nil {
		return fault.Wrap(fault.Internal, "锁定节点失败", err)
	}
	endpointcommon.WriteJSON(w, http.StatusOK, state)
	return nil
}

// A frozen node keeps its planning exchange in the public node ledger as well as in its source conversation.
// This is best-effort: the execution node remains valid when an old conversation cannot be copied.
func (h *Handler) copyPlanningConversationToNodeMessages(ctx context.Context, conversationID, nodeID string, userID uint64) {
	_ = h.conversation.CopyPlanningMessagesToNode(ctx, conversationID, nodeID, userID)
}
