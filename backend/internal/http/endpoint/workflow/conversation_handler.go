package workflow

import (
	"context"
	"net/http"
	"strings"

	applicationconversation "github.com/singaurora/exec-graph/backend/internal/application/conversation"
	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
)

type createConversationRequest = applicationconversation.OpenPlanningInput
type openCompletionReviewConversationRequest = applicationconversation.OpenCompletionInput

type sendConversationMessageRequest struct {
	ConversationUUID string `json:"conversationUuid"`
	Body             string `json:"body"`
}

type conversationCommandRequest struct {
	ConversationUUID string `json:"conversationUuid"`
}

// OpenPlanningConversation 返回当前规划对话；不存在时创建新对话。
func (h *Handler) OpenPlanningConversation(w http.ResponseWriter, r *http.Request, userID uint64) error {
	var input createConversationRequest
	if err := bindJSON(r, &input); err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(r.Context(), sharedconstants.ConversationSetupTimeout)
	defer cancel()
	conversation, err := h.conversation.OpenPlanningConversation(ctx, userID, input)
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, map[string]any{"conversation": conversation})
	return nil
}

// OpenCompletionReviewConversation 返回或创建指定节点的完成审查对话。
func (h *Handler) OpenCompletionReviewConversation(w http.ResponseWriter, r *http.Request, userID uint64) error {
	var input openCompletionReviewConversationRequest
	if err := bindJSON(r, &input); err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(r.Context(), sharedconstants.ConversationSetupTimeout)
	defer cancel()
	conversation, err := h.conversation.OpenCompletionConversation(ctx, userID, input)
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, map[string]any{"conversation": conversation})
	return nil
}

// GetAIConversation 返回一份规划对话或完成审查对话。
func (h *Handler) GetAIConversation(w http.ResponseWriter, r *http.Request, userID uint64) error {
	conversationUUID := strings.TrimSpace(r.URL.Query().Get("conversationUuid"))
	ctx, cancel := context.WithTimeout(r.Context(), sharedconstants.ConversationSetupTimeout)
	defer cancel()
	conversation, err := h.conversation.GetConversation(ctx, userID, conversationUUID)
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, map[string]any{"conversation": conversation})
	return nil
}

// SendConversationMessage 向规划或完成审查对话追加一条用户消息。
func (h *Handler) SendConversationMessage(w http.ResponseWriter, r *http.Request, userID uint64) error {
	var input sendConversationMessageRequest
	if err := bindJSON(r, &input); err != nil {
		return err
	}
	return h.sendConversationMessage(w, r, userID, input.ConversationUUID, input.Body, false)
}

// RequestPlanningDraftFreezeReview 请求 AI 审核当前规划草案是否可以冻结。
func (h *Handler) RequestPlanningDraftFreezeReview(w http.ResponseWriter, r *http.Request, userID uint64) error {
	var input conversationCommandRequest
	if err := bindJSON(r, &input); err != nil {
		return err
	}
	body := "请基于当前对话和草案进行冻结审核；只在全部字段清晰、可验证且证据要求充分时允许冻结。"
	return h.sendConversationMessage(w, r, userID, input.ConversationUUID, body, true)
}

func (h *Handler) sendConversationMessage(w http.ResponseWriter, r *http.Request, userID uint64, conversationUUID, body string, freezeReview bool) error {
	ctx, cancel := context.WithTimeout(r.Context(), sharedconstants.ConversationReviewTimeout)
	defer cancel()
	conversation, err := h.conversation.SendMessage(ctx, userID, conversationUUID, body, freezeReview)
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, map[string]any{"conversation": conversation})
	return nil
}
