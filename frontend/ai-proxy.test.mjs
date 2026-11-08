import { describe, expect, test } from 'bun:test'
import viteConfig from './vite.config.ts'

describe('AI proxy credential isolation', () => {
  test('only forwards business API requests without holding model credentials', () => {
    const { server } = viteConfig
    const proxies = server.proxy
    expect(Object.keys(proxies)).toEqual(['/api'])
    const proxy = proxies['/api']
    expect(proxy.headers).toBeUndefined()
    expect(proxy.target).toBe('http://127.0.0.1:8080')
  })
})
