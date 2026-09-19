package endpoint

import (
	"errors"
	"net/http"
	"strings"

	applicationproject "github.com/singaurora/exec-graph/backend/internal/application/project"
)

type createExecutionNodeRequest struct {
	Draft                  string                   `json:"draft"`
	DraftReview            nodeDraftReviewResponse  `json:"draftReview"`
	Title                  string                   `json:"title"`
	VerifiableGoal         string                   `json:"verifiableGoal"`
	AcceptanceCriteria     []reviewCriterionRequest `json:"acceptanceCriteria"`
	EvidenceRequirement    string                   `json:"evidenceRequirement"`
	ParentContractID       string                   `json:"parentContractId"`
	SourceContractIDs      []string                 `json:"sourceContractIds"`
	BranchID               string                   `json:"branchId"`
	Fork                   bool                     `json:"fork"`
	SupplementOfNodeID     string                   `json:"supplementOfContractId"`
	RetryOfContractID      string                   `json:"retryOfContractId"`
	Closure                bool                     `json:"closure"`
	PlanningConversationID string                   `json:"planningConversationId"`
}

// createExecutionNode 只负责把 HTTP 请求转换为项目领域的创建节点用例。
func (s *Server) createExecutionNode(w http.ResponseWriter, r *http.Request, userID uint64, projectID string) {
	var request createExecutionNodeRequest
	if !bindJSON(w, r, &request) {
		return
	}
	criteria := make([]applicationproject.Criterion, 0, len(request.AcceptanceCriteria))
	for _, item := range request.AcceptanceCriteria {
		criteria = append(criteria, applicationproject.Criterion{ID: item.ID, Text: item.Text, RequiredEvidence: item.RequiredEvidence})
	}
	result, err := s.project.CreateNode(r.Context(), applicationproject.CreateNodeInput{
		OwnerID:                userID,
		ProjectID:              projectID,
		Draft:                  request.Draft,
		DraftReview:            request.DraftReview,
		DraftReviewVerdict:     request.DraftReview.Verdict,
		DraftReviewKeyID:       request.DraftReview.AIConfig.KeyID,
		Title:                  request.Title,
		VerifiableGoal:         request.VerifiableGoal,
		AcceptanceCriteria:     criteria,
		EvidenceRequirement:    request.EvidenceRequirement,
		ParentContractID:       request.ParentContractID,
		SourceContractIDs:      request.SourceContractIDs,
		BranchID:               request.BranchID,
		Fork:                   request.Fork,
		SupplementOfNodeID:     request.SupplementOfNodeID,
		RetryOfContractID:      request.RetryOfContractID,
		Closure:                request.Closure,
		PlanningConversationID: request.PlanningConversationID,
	})
	if errors.Is(err, applicationproject.ErrNotFound) {
		writeError(w, http.StatusNotFound, "项目不存在")
		return
	}
	var validation *applicationproject.ValidationError
	if errors.As(err, &validation) {
		writeError(w, http.StatusBadRequest, validation.Message)
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "创建节点失败")
		return
	}
	if strings.TrimSpace(request.PlanningConversationID) != "" {
		s.copyPlanningConversationToNodeMessages(r.Context(), request.PlanningConversationID, result.NodeID, userID)
	}
	writeJSON(w, http.StatusCreated, result.State)
}

// lockExecutionNode 只负责把确认动作交给项目领域服务。
func (s *Server) lockExecutionNode(w http.ResponseWriter, r *http.Request, userID uint64, projectID, nodeID string) {
	state, err := s.project.LockNode(r.Context(), userID, projectID, nodeID)
	if errors.Is(err, applicationproject.ErrNotFound) {
		writeError(w, http.StatusNotFound, "项目或节点不存在")
		return
	}
	var validation *applicationproject.ValidationError
	if errors.As(err, &validation) {
		writeError(w, http.StatusBadRequest, validation.Message)
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "锁定节点失败")
		return
	}
	writeJSON(w, http.StatusOK, state)
}
