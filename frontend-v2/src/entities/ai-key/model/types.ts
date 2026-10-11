/** Supported AI service providers. */
export type AIProvider = 'deepseek' | 'openai' | 'doubao' | 'claude' | 'openai_compatible'

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
}

/** Input accepted when saving an AI configuration. */
export type SaveAIKeyInput = Omit<AIKeyConfig, 'id' | 'isDefault'>
