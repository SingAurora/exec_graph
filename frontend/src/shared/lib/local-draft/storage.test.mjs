import 'fake-indexeddb/auto'
import { describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { readLocalDraft, writeLocalDraft } from './storage.ts'

describe('browser-local draft persistence', () => {
  test('a fresh read restores unsent input, conversation and an explicit empty document', async () => {
    const key = 'restore-' + randomUUID()
    const value = { input: '还没发送', messages: [{ id: 'user-1', speaker: 'user', body: '今天做了什么' }], draftDocument: '', generated: true }
    await writeLocalDraft(key, value)
    const saved = await readLocalDraft(key)
    expect(saved.version).toBe(1)
    expect(saved.value).toEqual(value)
    expect(Number.isNaN(Date.parse(saved.updatedAt))).toBe(false)
  })
  test('rapid edits followed by successful submission cannot resurrect an older queued save', async () => {
    const key = 'submit-' + randomUUID()
    await Promise.all([
      writeLocalDraft(key, { input: 'first' }),
      writeLocalDraft(key, { input: 'latest' }),
      writeLocalDraft(key, undefined, true),
    ])
    expect(await readLocalDraft(key)).toBeUndefined()
    await writeLocalDraft(key, { input: 'new draft after discard' })
    expect((await readLocalDraft(key)).value.input).toBe('new draft after discard')
  })
  test('failed writes report an error and do not destroy the last committed draft', async () => {
    const key = 'failure-' + randomUUID()
    await writeLocalDraft(key, { input: 'safe draft' })
    await expect(writeLocalDraft(key, { uncloneable: () => {} })).rejects.toThrow()
    expect((await readLocalDraft(key)).value).toEqual({ input: 'safe draft' })
  })
  test('removing one editor draft leaves another node and account untouched', async () => {
    const key = randomUUID()
    await writeLocalDraft(key + '-one', { input: 'first node' })
    await writeLocalDraft(key + '-two', { input: 'other node' })
    await writeLocalDraft(key + '-one', undefined, true)
    expect(await readLocalDraft(key + '-one')).toBeUndefined()
    expect((await readLocalDraft(key + '-two')).value).toEqual({ input: 'other node' })
  })
})
