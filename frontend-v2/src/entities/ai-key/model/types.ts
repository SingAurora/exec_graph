/** Supported AI service providers. */
export type AIProvider = 'deepseek' | 'openai' | 'doubao' | 'claude' | 'openai_compatible'

/** Saved AI configuration without the raw API key. */
export type AIKeyConfig = {
  id: string
  provider: AIProvider
  label: string
  model: string
  baseUrl: string
  keyHint: string
  isDefault: boolean
}

/** Input accepted when saving an AI configuration. */
export type SaveAIKeyInput = Omit<AIKeyConfig, 'id' | 'isDefault'>
