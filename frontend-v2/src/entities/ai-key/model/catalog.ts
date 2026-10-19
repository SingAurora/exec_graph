import type { AIKeyConfig, AIProvider } from './types'

/**
 * Official text models offered by the application, checked on 2026-10-19.
 * Sources: https://developers.openai.com/api/docs/models
 * and https://api-docs.deepseek.com/quick_start/pricing.
 */
export const aiProviders = [
  {
    id: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1',
    models: [
      { id: 'deepseek-flash', label: 'DeepSeek Flash' },
      { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
    ],
  },
  {
    id: 'openai', label: 'GPT', baseUrl: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-6.1-sol', label: 'GPT-6.1 Sol' },
      { id: 'gpt-6-astra', label: 'GPT-6 Astra' },
      { id: 'gpt-6-luna', label: 'GPT-6 Luna' },
    ],
  },
] satisfies Array<{ id: AIProvider; label: string; baseUrl: string; models: Array<{ id: string; label: string }> }>

/** Default configuration uses the existing server-side key without exposing it to the browser. */
export const platformAIConfig: AIKeyConfig = {
  id: 'demo-deepseek-flash', provider: 'deepseek', label: '默认配置',
  model: 'deepseek-flash', baseUrl: 'https://api.deepseek.com/v1',
  keyHint: '使用平台密钥', isDefault: true, source: 'platform',
}
