import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { getAPI, postAPI } from './client.ts'

const { URL, Response, AbortController } = globalThis

const originalFetch = globalThis.fetch
const originalLocation = Object.getOwnPropertyDescriptor(globalThis, 'location')
beforeEach(() => Object.defineProperty(globalThis, 'location', { configurable: true, value: new URL('http://localhost') }))
afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalLocation) Object.defineProperty(globalThis, 'location', originalLocation)
  else delete globalThis.location
})

describe('business transport', () => {
  test('encodes queries once, omits absent values and keeps empty responses', async () => {
    let requested
    globalThis.fetch = async (url, options) => {
      requested = { url: new URL(url), options }
      return Response.json({ code: 0, msg: '', data: [] })
    }
    expect(await getAPI('/api/commands/actions/search', { keyword: '番茄 & 蛋', absent: undefined, missing: null, authorId: ['a', 'b'], page: 2 })).toEqual([])
    expect(requested.url.searchParams.get('keyword')).toBe('番茄 & 蛋')
    expect(requested.url.searchParams.getAll('authorId')).toEqual(['a', 'b'])
    expect(requested.url.searchParams.has('absent')).toBe(false)
    expect(requested.options.credentials).toBe('include')
  })

  test('sends explicit clearing JSON and write headers without rewriting Markdown', async () => {
    let requested
    globalThis.fetch = async (_url, options) => { requested = options; return Response.json({ code: 0, msg: '', data: null }) }
    const input = { document: { mode: 'clear' }, markdown: '  # 文档\n' }
    expect(await postAPI('/api/commands/agreements/update', input, { csrfToken: 'csrf', idempotencyKey: 'key' })).toBeNull()
    expect(JSON.parse(requested.body)).toEqual(input)
    expect(requested.method).toBe('POST')
    expect(requested.headers.get('X-CSRF-Token')).toBe('csrf')
    expect(requested.headers.get('Idempotency-Key')).toBe('key')
  })

  test('rejects nonzero code even on HTTP 200 and preserves unknown codes and request ID', async () => {
    globalThis.fetch = async () => Response.json({ code: 123456, msg: '业务失败', data: null }, { headers: { 'X-Request-Id': 'trace' } })
    await expect(getAPI('/api/commands/graphs/catalogue')).rejects.toMatchObject({ kind: 'business', code: 123456, status: 200, requestId: 'trace', message: '业务失败' })
  })

  test('distinguishes HTTP business errors from malformed JSON/envelopes', async () => {
    globalThis.fetch = async () => Response.json({ code: 10003, msg: '无权限', data: null }, { status: 403 })
    await expect(getAPI('/api/commands/graphs/catalogue')).rejects.toMatchObject({ kind: 'business', status: 403, code: 10003 })
    globalThis.fetch = async () => new Response('<html>proxy error</html>', { status: 502 })
    await expect(getAPI('/api/commands/graphs/catalogue')).rejects.toMatchObject({ kind: 'protocol', status: 502 })
    globalThis.fetch = async () => Response.json({ code: 0, msg: '' })
    await expect(getAPI('/api/commands/graphs/catalogue')).rejects.toMatchObject({ kind: 'protocol' })
  })

  test('distinguishes caller cancellation, timeout and network failure without retrying', async () => {
    let calls = 0
    globalThis.fetch = async (_url, { signal }) => {
      calls++
      return new Promise((_resolve, reject) => {
        if (signal.aborted) reject(signal.reason)
        else signal.addEventListener('abort', () => reject(signal.reason), { once: true })
      })
    }
    const controller = new AbortController()
    const cancelled = getAPI('/api/commands/graphs/catalogue', {}, { signal: controller.signal })
    controller.abort()
    await expect(cancelled).rejects.toMatchObject({ kind: 'cancelled' })
    await expect(getAPI('/api/commands/graphs/catalogue', {}, { timeoutMs: 5 })).rejects.toMatchObject({ kind: 'timeout' })
    expect(calls).toBe(2)
    globalThis.fetch = async () => { throw new TypeError('offline') }
    await expect(getAPI('/api/commands/graphs/catalogue')).rejects.toMatchObject({ kind: 'network' })
  })
})
