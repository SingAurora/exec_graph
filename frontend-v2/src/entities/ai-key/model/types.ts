/** Supported AI service providers. */
export type AIProvider = 'deepseek' | 'openai'

/** Saved AI configuration held in the current frontend session. */
export type AIKeyConfig = {
  id: string
  provider: AIProvider
  label: string
  model: string
  baseUrl: string
  keyHint: string
  apiKey?: string
  isDefault: boolean
  source?: 'platform' | 'personal'
}

/** Input accepted when saving an AI configuration. */
export type SaveAIKeyInput = Omit<AIKeyConfig, 'id' | 'isDefault' | 'source'>
