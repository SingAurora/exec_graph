import { afterEach, describe, expect, test } from 'bun:test'
import { generateDraft } from './generation.ts'

const { URL, crypto, Response, AbortController } = globalThis
const originalFetch = globalThis.fetch
const originalLocation = Object.getOwnPropertyDescriptor(globalThis, 'location')
afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalLocation) Object.defineProperty(globalThis, 'location', originalLocation)
  else delete globalThis.location
})

describe('platform generation transport', () => {
  test('submits only this turn and reuses the saved submission identity after response loss', async () => {
    Object.defineProperty(globalThis, 'location', { configurable: true, value: new URL('http://localhost') })
    const request = { key: crypto.randomUUID(), input: { mode: 'action', graphId: 'graph', message: '骑了六公里', mergedParentIds: [], sourceVersions: [], agreement: { mode: 'clear' } } }
    const calls = []
    globalThis.fetch = async (_url, options) => {
      calls.push(options)
      if (calls.length === 1) throw new TypeError('response lost')
      return Response.json({ code: 0, msg: '', data: { generationId: 'generation', conversationId: 'conversation', status: 'succeeded' } })
    }
    await expect(generateDraft(request, 'csrf', new AbortController().signal)).rejects.toMatchObject({ kind: 'network' })
    expect(calls).toHaveLength(1)
    expect(await generateDraft(request, 'csrf', new AbortController().signal)).toMatchObject({ status: 'succeeded' })
    expect(calls.map((call) => call.headers.get('Idempotency-Key'))).toEqual([request.key, request.key])
    expect(calls.map((call) => JSON.parse(call.body))).toEqual([request.input, request.input])
    expect(calls[0].headers.has('Authorization')).toBe(false)
  })
})
