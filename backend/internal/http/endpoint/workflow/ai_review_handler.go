package workflow

import (
	"context"
	"net/http"

	applicationreview "github.com/singaurora/exec-graph/backend/internal/application/review"
	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
)

type reviewExecutionNodeRequest = applicationreview.CompletionRequest
type reviewClarificationRequest = applicationreview.ClarificationInput
type reviewNodeDraftRequest = applicationreview.DraftRequest
type aiConfigSnapshot = applicationreview.AIConfigSnapshot

// ReviewNodeCompletion 审查节点完成说明及其逐条证据。
func (h *Handler) ReviewNodeCompletion(w http.ResponseWriter, r *http.Request, userID uint64) error {
	var input reviewExecutionNodeRequest
	if err := bindJSON(r, &input); err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(r.Context(), sharedconstants.CompletionReviewTimeout)
	defer cancel()
	review, err := h.reviewer.SubmitCompletion(ctx, userID, input)
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, map[string]any{"review": review})
	return nil
}

// ReviewNodeClarification 使用可追溯的补充证据重新审查指定缺口。
func (h *Handler) ReviewNodeClarification(w http.ResponseWriter, r *http.Request, userID uint64) error {
	var input reviewClarificationRequest
	if err := bindJSON(r, &input); err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(r.Context(), sharedconstants.CompletionReviewTimeout)
	defer cancel()
	review, err := h.reviewer.ReviewClarification(ctx, userID, input)
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, map[string]any{"review": review})
	return nil
}

// ReviewNodeDraft 判断规划草案是否清晰、可验证并允许冻结。
func (h *Handler) ReviewNodeDraft(w http.ResponseWriter, r *http.Request, userID uint64) error {
	var request reviewNodeDraftRequest
	if err := bindJSON(r, &request); err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(r.Context(), sharedconstants.NodeDraftReviewTimeout)
	defer cancel()
	review, err := h.reviewer.ReviewProjectDraft(ctx, userID, request)
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, map[string]any{"review": review})
	return nil
}
