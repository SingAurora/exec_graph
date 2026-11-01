import { describe, expect, test } from 'bun:test'
import process from 'node:process'
import viteConfig from './vite.config.ts'

describe('AI proxy credential isolation', () => {
  test('only forwards business API requests without holding model credentials', () => {
    const originalKey = process.env.DEEPSEEK_API_KEY
    process.env.DEEPSEEK_API_KEY = 'platform-test-key'
    try {
      const { server } = viteConfig({ mode: 'development', command: 'serve' })
      const proxies = server.proxy
      expect(Object.keys(proxies)).toEqual(['/api'])
      const proxy = proxies['/api']
      expect(proxy.headers).toBeUndefined()
      expect(proxy.target).toBe('http://127.0.0.1:8080')
    } finally {
      if (originalKey === undefined) delete process.env.DEEPSEEK_API_KEY
      else process.env.DEEPSEEK_API_KEY = originalKey
    }
  })
})
