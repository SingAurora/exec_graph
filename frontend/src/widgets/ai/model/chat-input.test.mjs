import { describe, expect, test } from 'bun:test'
import { shouldSendChatOnEnter } from './chat-input.ts'

describe('chat input keyboard behavior', () => {
  test('Enter sends, Shift+Enter adds a newline', () => {
    expect(shouldSendChatOnEnter('Enter', false, false)).toBe(true)
    expect(shouldSendChatOnEnter('Enter', true, false)).toBe(false)
    expect(shouldSendChatOnEnter('a', false, false)).toBe(false)
  })

  test('IME composition does not send accidentally', () => {
    expect(shouldSendChatOnEnter('Enter', false, true)).toBe(false)
  })
})
