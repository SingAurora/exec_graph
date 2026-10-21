import { describe, expect, test } from 'bun:test'
import viteConfig from './vite.config.ts'

describe('AI proxy credential isolation', () => {
  test('only the platform proxy injects the saved key; personal providers preserve request credentials', () => {
    const { server } = viteConfig({ mode: 'development', command: 'serve' })
    const proxies = server.proxy
    expect(typeof proxies['/platform-ai-api'].headers.Authorization).toBe('string')
    expect(proxies['/deepseek-api'].headers).toBeUndefined()
    expect(proxies['/openai-api'].headers).toBeUndefined()
    expect(proxies['/platform-ai-api'].target).toBe('https://api.deepseek.com')
    expect(proxies['/deepseek-api'].target).toBe('https://api.deepseek.com')
    expect(proxies['/openai-api'].target).toBe('https://api.openai.com')
    for (const [prefix, proxy] of Object.entries(proxies)) {
      expect(proxy.rewrite(`${prefix}/v1/chat/completions`)).toBe('/v1/chat/completions')
    }
  })
})
