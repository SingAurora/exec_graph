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
type openTaskRequirementRevisionRequest = applicationconversation.OpenRevisionInput
type finalizeTaskRequirementRevisionRequest = applicationconversation.FinalizeRevisionInput
type finalizeCompletionReviewRequest = applicationconversation.FinalizeCompletionInput

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

// OpenTaskRequirementRevisionConversation 打开通过 AI 修改当前行动要求的对话。
func (h *Handler) OpenTaskRequirementRevisionConversation(w http.ResponseWriter, r *http.Request, userID uint64) error {
	var input openTaskRequirementRevisionRequest
	if err := bindJSON(r, &input); err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(r.Context(), sharedconstants.ConversationSetupTimeout)
	defer cancel()
	conversation, err := h.conversation.OpenRevisionConversation(ctx, userID, input)
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

// ClearAIConversation 清空当前用户尚未结束的规划或完成审查对话。
func (h *Handler) ClearAIConversation(w http.ResponseWriter, r *http.Request, userID uint64) error {
	var input conversationCommandRequest
	if err := bindJSON(r, &input); err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(r.Context(), sharedconstants.ConversationSetupTimeout)
	defer cancel()
	conversation, err := h.conversation.ClearConversation(ctx, userID, input.ConversationUUID)
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, map[string]any{"conversation": conversation})
	return nil
}

// FinalizeCompletionReviewConversation 结束完成审查对话并保存完整验收结论。
func (h *Handler) FinalizeCompletionReviewConversation(w http.ResponseWriter, r *http.Request, userID uint64) error {
	var input finalizeCompletionReviewRequest
	if err := bindJSON(r, &input); err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(r.Context(), sharedconstants.ConversationReviewTimeout)
	defer cancel()
	conversation, err := h.conversation.FinalizeCompletionConversation(ctx, userID, input)
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, map[string]any{"conversation": conversation})
	return nil
}

// FinalizeTaskRequirementRevisionConversation 确认新的行动要求并清除旧完成对话。
func (h *Handler) FinalizeTaskRequirementRevisionConversation(w http.ResponseWriter, r *http.Request, userID uint64) error {
	var input finalizeTaskRequirementRevisionRequest
	if err := bindJSON(r, &input); err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(r.Context(), sharedconstants.ConversationSetupTimeout)
	defer cancel()
	conversation, err := h.conversation.FinalizeRevisionConversation(ctx, userID, input)
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
	body := "请基于当前对话和草案检查行动是否足够清楚；只有目标、做到位清单和记录要求充分时，才允许保存为推进。"
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
