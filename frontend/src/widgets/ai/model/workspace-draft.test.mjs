import { describe, expect, test } from 'bun:test'
import { createWorkspaceView, isActionWorkspaceDraft, isExpressionWorkspaceDraft, reconcileWorkspaceDraft } from './workspace-draft.ts'
import { getActionDraftKey } from '../../../entities/action/lib/draft-key.ts'
import { isAgreementDraft } from '../../../features/action-agreement/model/draft.ts'

const draft = () => ({
  messages: [{ id: 'user-1', speaker: 'user', body: '今天换了锅', authorId: 'jo' }, { id: 'ai-1', speaker: 'ai', body: '已整理' }],
  input: '还想补充一点', document: '# 换锅后的行动', details: { title: '换锅', description: '新观察', points: ['蛋偏硬'], note: '' },
  generated: true, expression: { mode: 'clear', markdown: '' }, agreementMode: 'update', agreementDraft: '记录锅具',
  agreementReviews: [{ nodeNumber: 9, complies: false, reason: '没有计时' }], mergedParentIds: ['source-2'], sourcesChanged: false,
  contextSignature: 'original-context', view: { tab: 'expression', positions: { conversation: 230, expression: 140 } },
})

describe('local workspace drafts', () => {
  test('keeps the conversation, unsent input, both documents, merge choices, reviews and view after serialization', () => {
    const restored = JSON.parse(JSON.stringify(draft()))
    expect(isActionWorkspaceDraft(restored)).toBe(true)
    expect(restored.messages[0].authorId).toBe('jo')
    expect(restored.expression).toEqual({ mode: 'clear', markdown: '' })
    expect(restored.view.positions.expression).toBe(140)
    expect(restored.mergedParentIds).toEqual(['source-2'])
    expect(restored.agreementReviews[0].complies).toBe(false)
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
