import { describe, expect, test } from 'bun:test'
import { formatConversationForCopy } from './format-conversation.ts'

const messages = [
  { speaker: 'user', body: '我做了好多事情', authorId: 'jo' },
  { speaker: 'ai', body: '请补充这次实际做了什么', model: 'deepseek-v4-pro' },
  { speaker: 'user', body: '我洗了菜', authorId: 'lin' },
  { speaker: 'ai', body: '已整理', model: ' ' },
]

describe('conversation copy', () => {
  test('uses the actual model name for AI turns and resolved names for users', () => {
    const text = formatConversationForCopy(messages, {
      resolveUserName: (message) => message.authorId === 'jo' ? '乔' : '林岚',
    })
    expect(text).toContain('乔：\n我做了好多事情')
    expect(text).toContain('deepseek-v4-pro：\n请补充这次实际做了什么')
    expect(text).toContain('林岚：\n我洗了菜')
    expect(text).toContain('引序 AI：\n已整理')
  })

  test('falls back to the product AI name when an old message has no model', () => {
    const text = formatConversationForCopy([{ speaker: 'ai', body: '旧回复' }], { resolveUserName: () => '用户' })
    expect(text).toBe('引序 AI：\n旧回复')
  })
})
