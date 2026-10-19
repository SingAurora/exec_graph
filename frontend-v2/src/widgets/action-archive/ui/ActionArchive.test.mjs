import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ActionArchive } from './ActionArchive.tsx'
import { getActionExpressionChange } from '../../../entities/action/lib/formation.ts'

const node = (number, parentId, expressionMarkdown, extra = {}) => ({
  id: String(number), projectId: 'graph', number, parentId, expressionMarkdown, authorId: 'jo', title: `行动 ${number}`,
  markdown: '文档正文', images: [], conversation: [], createdAt: '2026-10-18T12:00:00+08:00', ...extra,
})
const user = { id: 'jo', name: '乔', avatar: '' }
function render(actions, id) {
  return renderToStaticMarkup(createElement(ActionArchive, {
    node: actions.find((item) => item.id === id), actions, users: [user], project: { id: 'graph', title: '测试图' }, onBack() {}, onSelectSource() {},
  }))
}

function panels(html) {
  const [, action, expression] = html.split(/<div\b[^>]*role="tabpanel"[^>]*>/u)
  return { action, expression }
}

describe('action formation provenance', () => {
  test('continues original dialogue with expression revision turns and credits the participant', () => {
    const action = node(1, undefined, '更新后的表达', {
      conversation: [{ id: 'original-user', speaker: 'user', body: '原本的行动对话' }],
      expressionSupplement: { authorId: 'lin', createdAt: '2026-10-18T15:00:00+08:00', kind: 'modify' },
      expressionConversation: [{ id: 'expression-user', speaker: 'user', body: '更新表达的对话', authorId: 'lin' }, { id: 'expression-ai', speaker: 'ai', body: '对话生成的新表达' }],
    })
    const html = render([action], '1')
    expect(html.indexOf('原本的行动对话')).toBeLessThan(html.indexOf('更新表达的对话'))
    expect(html).toContain('对话生成的新表达')
    expect(html).toContain('查看lin的主页')
    expect(html).toContain('已记录表达对话')
    expect(html).not.toContain('未记录编辑对话')
    expect(action.conversation).toHaveLength(1)
    const content = panels(html)
    expect(html.match(/原本的行动对话/g)).toHaveLength(1)
    expect(html.match(/更新表达的对话/g)).toHaveLength(1)
    expect(content.action).not.toContain('原本的行动对话')
    expect(content.action).not.toContain('更新表达的对话')
    expect(content.action).not.toContain('更新后的表达')
    expect(content.expression).not.toContain('原本的行动对话')
    expect(content.expression).toContain('更新后的表达')
  })

  test('pairs both generated documents with their shared initial conversation', () => {
    const action = node(1, undefined, 'AI 整理的表达全文', {
      objectiveMarkdown: 'AI 整理的行动全文',
      conversation: [{ id: 'user', speaker: 'user', body: '做了一顿饭，想留下自己的口味偏好' }, { id: 'ai', speaker: 'ai', body: '已分别整理行动和表达' }],
    })
    const html = render([action], '1')
    const content = panels(html)
    expect(html).toContain('aria-label="AI 对话"')
    expect(html.match(/已分别整理行动和表达/g)).toHaveLength(1)
    expect(html.indexOf('已分别整理行动和表达')).toBeLessThan(html.indexOf('文档结果'))
    expect(content.action).toContain('aria-label="行动结果"')
    expect(content.action).toContain('AI 整理的行动全文')
    expect(content.expression).toContain('aria-label="表达结果"')
    expect(content.expression).toContain('AI 整理的表达全文')
    expect(content.expression).not.toContain('AI 整理的行动全文')
  })

  test('inherited expression results link to their source without mixing its conversation into this node', () => {
    const source = node(1, undefined, '源节点的表达', { authorId: 'lin', conversation: [{ id: 'source', speaker: 'user', body: '源节点的表达想法' }] })
    const child = node(2, '1', undefined, { conversation: [{ id: 'child', speaker: 'user', body: '本次只记录行动，沿用表达' }] })
    const html = render([source, child], '2')
    expect(html).toContain('本次只记录行动，沿用表达')
    expect(html).not.toContain('源节点的表达想法')
    expect(html).toContain('查看表达来源节点 #1的形成过程')
    expect(panels(html).expression).toContain('源节点的表达')
  })
  test('distinguishes missing, explicitly cleared, inherited and revised expressions', () => {
    const actions = [node(1), node(2, '1', '最早的表达'), node(3, '2'), node(4, '3', '新表达'), node(5, '4', ''), node(6, '5')]
    expect(getActionExpressionChange(actions, '1').kind).toBe('empty')
    expect(getActionExpressionChange(actions, '2').kind).toBe('initial')
    expect(getActionExpressionChange(actions, '3')).toEqual({ kind: 'inherited', source: actions[1] })
    expect(getActionExpressionChange(actions, '4')).toEqual({ kind: 'modified', source: actions[1] })
    expect(getActionExpressionChange(actions, '5').kind).toBe('cleared')
    expect(getActionExpressionChange(actions, '6').kind).toBe('empty')
    expect(render(actions, '5')).toContain('已主动清空表达')
    expect(panels(render(actions, '6')).expression).toContain('表达为空')
  })

  test('puts the conversation before directly displayed documents and renders the real author and Markdown', () => {
    const html = render([node(1, undefined, '表达全文', { conversation: [{ id: 'message', speaker: 'user', body: '第一段\n\n**第二段**' }] })], '1')
    expect(html.indexOf('aria-label="AI 对话"')).toBeLessThan(html.indexOf('aria-label="行动结果"'))
    expect(html).toContain('<strong>第二段</strong>')
    expect(html).toContain('查看乔的主页')
    expect(html).not.toContain('>行动者<')
    expect(html).not.toMatch(/<details[^>]*\sopen[\s=>]/)
  })

  test('keeps continuation, merge and noncompliance distinct without trusting stale snapshot counts', () => {
    const actions = [node(1), node(2, '1', '表达', { agreementMarkdown: '固定份量' }), node(3, '1'), node(4, '2', undefined, {
      mergedParentIds: ['3'], contextSnapshot: { directNodeIds: [], historyNodeCount: 99 },
      referenceAgreements: [{ sourceId: '2', complies: false, exceptionReason: '换份量' }],
    }), node(99, undefined, '无关分支')]
    const html = render(actions, '4')
    expect(html).toContain('承接 #2')
    expect(html).toContain('合入 #3')
    expect(html).toContain('历史 3 个节点')
    expect(html).not.toContain('历史 99 个节点')
    expect(html).not.toContain('无关分支')
    expect(html).toContain('× 不满足原约定')
    expect(html).toContain('不符合原因：换份量')
    expect(html).not.toMatch(/授权|自动同意|等待来源作者同意/)
    expect(html).toContain('查看表达来源节点 #2的形成过程')
  })

  test('identifies later supplements without changing the original conversation', () => {
    const action = node(1, undefined, '补充的表达', { expressionSupplement: { authorId: 'jo', createdAt: '2026-10-18T15:00:00+08:00' } })
    const html = render([action], '1')
    expect(html).toContain('发布后补充表达')
    expect(html).toContain('未记录编辑对话')
    expect(html).toContain('暂无对话记录')
    expect(action.conversation).toEqual([])
  })

  test('shows a supplemented agreement as a later document rather than an original AI conversation', () => {
    const action = node(1, undefined, '', { agreementMarkdown: '后续记录实际用时', agreementSupplement: { authorId: 'jo', createdAt: '2026-10-18T15:00:00+08:00' },
      conversation: [{ id: 'original', speaker: 'user', body: '原始行动说明' }] })
    const html = render([action], '1')
    expect(html).toContain('aria-label="约定结果"')
    expect(html).toContain('后续记录实际用时')
    expect(html).toContain('发布后补充约定')
    expect(html).toContain('未记录编辑对话')
    expect(action.conversation).toEqual([{ id: 'original', speaker: 'user', body: '原始行动说明' }])
  })

  test('labels later modifications and clears accurately, including empty document results', () => {
    for (const kind of ['modify', 'clear']) {
      const revision = { kind, authorId: 'jo', createdAt: '2026-10-18T16:00:00+08:00' }
      const action = node(1, undefined, kind === 'clear' ? '' : '修改后的表达', {
        expressionSupplement: revision, agreementMarkdown: kind === 'clear' ? '' : '修改后的约定', agreementSupplement: revision,
      })
      const html = render([action], '1')
      const label = kind === 'clear' ? '清空' : '修改'
      expect(html).toContain(`发布后${label}表达`)
      expect(html).toContain(`发布后${label}约定`)
      expect(html).toContain('aria-label="表达结果"')
      expect(html).toContain('aria-label="约定结果"')
      expect(html).toContain('未记录编辑对话')
      expect(html).not.toContain('发布后补充表达 ·')
      expect(html).not.toContain('发布后补充约定 ·')
      expect(action.conversation).toEqual([])
    }
  })
})
