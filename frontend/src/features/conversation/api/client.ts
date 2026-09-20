import { postJSON } from '@/shared/api/client'
import type { ActionConversation, OpenPlanningConversationInput } from '../model/types'

export const openPlanningConversation = (accessToken: string, input: OpenPlanningConversationInput) =>
  postJSON<{ conversation: ActionConversation }>('/api/commands/projects/open-planning-conversation', input, accessToken)

export const sendConversationMessage = (accessToken: string, conversationUuid: string, body: string) =>
  postJSON<{ conversation: ActionConversation }>('/api/commands/conversations/send-conversation-message', { conversationUuid, body }, accessToken)

export const requestPlanningDraftFreezeReview = (accessToken: string, conversationUuid: string) =>
  postJSON<{ conversation: ActionConversation }>('/api/commands/conversations/request-planning-draft-freeze-review', { conversationUuid }, accessToken)
