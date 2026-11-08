import { describe, expect, test } from 'bun:test'
import { appendWorkspaceError, appendWorkspaceNotice, createWorkspaceView, isActionWorkspaceDraft, isExpressionWorkspaceDraft, normalizeGenerationRequest, pendingReportsForRestore, reconcileWorkspaceDraft } from './workspace-draft.ts'
import { getActionDraftKey } from '../../../entities/action/lib/draft-key.ts'
import { isAgreementDraft } from '../../../features/action-agreement/model/draft.ts'

const draft = () => ({
  messages: [{ id: 'user-1', speaker: 'user', body: '今天换了锅', authorUuid: 'jo' }, { id: 'ai-1', speaker: 'ai', body: '已整理' }],
  input: '还想补充一点', document: '# 换锅后的行动', details: { title: '换锅', description: '新观察', points: ['蛋偏硬'], note: '' },
  generated: true, expression: { mode: 'clear', markdown: '' }, agreementMode: 'update', agreementDraft: '记录锅具',
  agreementReviews: [{ nodeNumber: 9, complies: false, reason: '没有计时' }], mergedParentUuids: ['source-2'], sourcesChanged: false,
  contextSignature: 'original-context', view: { tab: 'expression', positions: { conversation: 230, expression: 140 } },
})

describe('local workspace drafts', () => {
  test('failed generation keeps the just-sent user message and replaces only older error notices', () => {
    const messages = [
      { id: 'welcome', speaker: 'ai', body: '先说说行动' },
      { id: 'error-old', speaker: 'ai', body: '上次失败' },
      { id: 'user-current', speaker: 'user', body: '今天骑了十公里' },
    ]

    expect(appendWorkspaceError(messages, 'AI 暂时不可用')).toMatchObject([
      { id: 'welcome', speaker: 'ai', body: '先说说行动' },
      { id: 'user-current', speaker: 'user', body: '今天骑了十公里' },
      { speaker: 'ai', body: 'AI 暂时不可用' },
    ])
  })

  test('business AI notices stay in the conversation instead of being replaced', () => {
    const messages = [
      { id: 'welcome', speaker: 'ai', body: '先说说行动' },
      { id: 'notice-old', speaker: 'ai', body: '请补充这次实际做了什么' },
      { id: 'user-current', speaker: 'user', body: '我做了好多事情' },
    ]

    const next = appendWorkspaceNotice(messages, '请补充这次实际做了什么、过程、结果或明确感受')
    expect(next).toHaveLength(4)
    expect(next[1]).toEqual(messages[1])
    expect(next[2]).toEqual(messages[2])
    expect(next[3]).toMatchObject({ speaker: 'ai', body: '请补充这次实际做了什么、过程、结果或明确感受' })
    expect(next[3].id.startsWith('notice-')).toBe(true)
  })

  test('keeps the model name attached to an AI turn in a saved draft', () => {
    const saved = { ...draft(), messages: [
      { id: 'ai-1', speaker: 'ai', body: '已整理', model: 'deepseek-flash' },
    ] }
    expect(isActionWorkspaceDraft(saved)).toBe(true)
    expect(saved.messages[0].model).toBe('deepseek-flash')
    expect(isActionWorkspaceDraft({ ...saved, messages: [{ ...saved.messages[0], model: 1 }] })).toBe(false)
  })

  test('keeps the conversation, unsent input, both documents, merge choices, reviews and view after serialization', () => {
    const restored = JSON.parse(JSON.stringify(draft()))
    expect(isActionWorkspaceDraft(restored)).toBe(true)
    expect(restored.messages[0].authorUuid).toBe('jo')
    expect(restored.expression).toEqual({ mode: 'clear', markdown: '' })
    expect(restored.view.positions.expression).toBe(140)
    expect(restored.mergedParentUuids).toEqual(['source-2'])
    expect(restored.agreementReviews[0].complies).toBe(false)
  })
  test('persists only the three verification states', () => {
    expect(isActionWorkspaceDraft({ ...draft(), verificationStatus: 'unverified' })).toBe(true)
    expect(isActionWorkspaceDraft({ ...draft(), verificationStatus: 'passed' })).toBe(true)
    expect(isActionWorkspaceDraft({ ...draft(), verificationStatus: 'failed' })).toBe(true)
    expect(isActionWorkspaceDraft({ ...draft(), verificationStatus: 'approved' })).toBe(false)
  })

  test('damaged storage cannot create a publishable action draft', () => {
    expect(isActionWorkspaceDraft({ ...draft(), messages: [{ speaker: 'system', body: 'bad' }] })).toBe(false)
    expect(isActionWorkspaceDraft({ ...draft(), agreementMode: 'approve' })).toBe(false)
    expect(isActionWorkspaceDraft({ ...draft(), view: { tab: 'expression', positions: { expression: -2 } } })).toBe(false)
    expect(isActionWorkspaceDraft({ ...draft(), details: undefined })).toBe(false)
  })
  test('empty generated expression and pending agreement clear stay distinct from no edit', () => {
    const expression = { messages: [], input: '', generated: true, draftDocument: '', contextSignature: 'original', view: createWorkspaceView() }
    expect(isExpressionWorkspaceDraft(expression)).toBe(true)
    expect(Object.hasOwn(JSON.parse(JSON.stringify(expression)), 'draftDocument')).toBe(true)
    expect(isAgreementDraft({ markdown: '', clearing: true, baseMarkdown: '保留总用时' })).toBe(true)
    expect(isAgreementDraft({ markdown: '', clearing: 'true' })).toBe(false)
  })
  test('changed published context retains writing but invalidates AI generation', () => {
    const saved = draft()
    expect(reconcileWorkspaceDraft(saved, 'original-context')).toBe(saved)
    const restored = reconcileWorkspaceDraft(saved, 'changed-agreement')
    expect(restored.generated).toBe(false)
    expect(restored.document).toBe(saved.document)
    expect(restored.messages).toEqual(saved.messages)
    expect(restored.input).toBe(saved.input)
  })
  test('restores old single-message pending requests without reopening successful drafts', () => {
    const oldRequest = { key: 'request', input: { mode: 'action', graphUuid: 'graph', message: '这次实际做了什么', mergedParentUuids: [], sourceVersions: [], agreement: { mode: 'clear' } } }
    const normalized = normalizeGenerationRequest(oldRequest)
    expect(normalized.input.messages).toEqual(['这次实际做了什么'])
    expect(pendingReportsForRestore({ ...draft(), generationRequest: oldRequest })).toEqual(['这次实际做了什么'])
    expect(pendingReportsForRestore({ ...draft(), generation: { generationUuid: 'g', conversationUuid: 'c', status: 'succeeded' }, generationRequest: oldRequest })).toEqual([])
  })
  test('recovers unsummarized user messages from an old failed conversation', () => {
    const saved = { ...draft(), messages: [
      { id: 'welcome', speaker: 'ai', body: '先说说这次实际做了什么。' },
      { id: 'user-old', speaker: 'user', body: '这次做了具体行动' },
      { id: 'error-old', speaker: 'ai', body: '暂时无法更新记录：请求超时' },
    ] }
    expect(pendingReportsForRestore({ ...saved, pendingReports: [] })).toEqual(['这次做了具体行动'])
  })
  test('account, graph, action source and operation cannot share a draft by accident', () => {
    const keys = [
      getActionDraftKey('jo', 'cooking', 'action'),
      getActionDraftKey('jo', 'cooking', 'action', 'source'),
      getActionDraftKey('lin', 'cooking', 'action', 'source'),
      getActionDraftKey('jo', 'another', 'action', 'source'),
      getActionDraftKey('jo', 'cooking', 'expression', 'source'),
      getActionDraftKey('jo', 'cooking', 'agreement', 'source'),
      getActionDraftKey('a:b', 'c', 'action', 'source'),
      getActionDraftKey('a', 'b:c', 'action', 'source'),
    ]
    expect(new Set(keys).size).toBe(keys.length)
  })
})
