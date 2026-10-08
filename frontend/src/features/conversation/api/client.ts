import { postJSON } from '@/shared/api/client'
import type { ActionConversation, FinalizeCompletionReviewInput, OpenPlanningConversationInput } from '../model/types'

export const openPlanningConversation = (accessToken: string, input: OpenPlanningConversationInput) =>
  postJSON<{ conversation: ActionConversation }>('/api/commands/projects/open-planning-conversation', input, accessToken)

export const clearConversation = (accessToken: string, conversationUuid: string) =>
  postJSON<{ conversation: ActionConversation }>('/api/commands/conversations/clear-ai-conversation', { conversationUuid }, accessToken)

export const sendConversationMessage = (accessToken: string, conversationUuid: string, body: string) =>
  postJSON<{ conversation: ActionConversation }>('/api/commands/conversations/send-conversation-message', { conversationUuid, body }, accessToken)

export const openCompletionReviewConversation = (accessToken: string, input: { projectUuid: string; nodeUuid: string }) =>
  postJSON<{ conversation: ActionConversation }>('/api/commands/projects/open-completion-review-conversation', input, accessToken)

export const openTaskRequirementRevisionConversation = (accessToken: string, input: { projectUuid: string; nodeUuid: string }) =>
  postJSON<{ conversation: ActionConversation }>('/api/commands/projects/open-task-requirement-revision-conversation', input, accessToken)

export const finalizeCompletionReviewConversation = (accessToken: string, input: FinalizeCompletionReviewInput) =>
  postJSON<{ conversation: ActionConversation }>('/api/commands/conversations/finalize-completion-review-conversation', input, accessToken)

export const finalizeTaskRequirementRevisionConversation = (accessToken: string, conversationUuid: string) =>
  postJSON<{ conversation: ActionConversation }>('/api/commands/conversations/finalize-task-requirement-revision-conversation', { conversationUuid }, accessToken)

export const requestPlanningDraftFreezeReview = (accessToken: string, conversationUuid: string) =>
  postJSON<{ conversation: ActionConversation }>('/api/commands/conversations/request-planning-draft-freeze-review', { conversationUuid }, accessToken)
