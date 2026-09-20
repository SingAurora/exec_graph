import { getJSON, postJSON } from '@/shared/api/client'
import type { AIKey, AIKeyDraft } from '../model/types'

export const listAIKeys = (accessToken: string) =>
  getJSON<{ keys?: AIKey[] }>('/api/commands/ai-keys/list-ai-keys', accessToken)

export const createAIKey = (accessToken: string, input: AIKeyDraft) =>
  postJSON<AIKey>('/api/commands/ai-keys/create-ai-key', input, accessToken)

export const testAIKeyConfiguration = (accessToken: string, input: AIKeyDraft) =>
  postJSON<{ message?: string }>('/api/commands/ai-keys/test-ai-key-configuration', input, accessToken)

export const verifySavedAIKey = (accessToken: string, keyUuid: string) =>
  postJSON<{ message?: string; lastVerifiedAt?: string }>('/api/commands/ai-keys/verify-saved-ai-key', { keyUuid }, accessToken)

export const deleteAIKey = (accessToken: string, keyUuid: string) =>
  postJSON<{ message?: string }>('/api/commands/ai-keys/delete-ai-key', { keyUuid }, accessToken)
