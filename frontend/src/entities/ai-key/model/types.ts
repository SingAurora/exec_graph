export type AIProvider = 'deepseek' | 'openai' | 'doubao' | 'claude' | 'openai_compatible'

export type AIKey = {
  uuid: string
  provider: AIProvider
  label: string
  model: string
  baseUrl: string
  apiKey?: string
  keyHint: string
  lastVerifiedAt?: string
}

export type AIKeyDraft = {
  provider: AIProvider
  label: string
  apiKey: string
  baseUrl: string
  model: string
}
