import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ToastContext } from '../../shared/ui/toast/ToastContext.ts'
import { ExpressionWorkspace } from './ExpressionWorkspace.tsx'

const root = { id: '1', number: 1, projectId: 'graph', authorId: 'jo', title: '第一盘', markdown: '实际行动', conversation: [{ id: 'original-user', speaker: 'user', body: '原始行动对话' }], expressionMarkdown: '已有表达' }
const render = (node = root, actions = [node]) => renderToStaticMarkup(createElement(ToastContext.Provider, { value: { showToast() {} } },
  createElement(ExpressionWorkspace, { node, actions, profileName: '乔', profileId: 'jo', onBack() {}, onConfirm() { return true } })))

describe('expression revision workspace', () => {
  test('opens a dialogue and read-only effective expression rather than another action or inline document editor', () => {
    const html = render()
    expect(html).toContain('已有表达')
    expect(html).not.toContain('原始行动对话')
    expect(html).toContain('>梳理表达</h2>')
    expect(html).toContain('>表达</span>')
    expect(html).not.toContain('实际行动')
    expect(html).not.toContain('只读文档')
    expect(html.match(/<textarea/g)).toHaveLength(1)
    expect(html).toContain('表达对话内容')
    expect(html).toContain('trigger-conversation')
    expect(html).not.toContain('已有行动对话')
    expect(html).not.toContain('原始行动对话')
    expect(html).not.toContain('保存表达')
    expect(html).not.toContain('发布表达')
    expect(html).not.toContain('发布行动节点')
    expect(html).not.toContain('清空表达</button>')
    expect(html).not.toContain('title="约定处理方式"')
    expect(html).not.toContain('grid-cols-')
    expect(html).toContain('默认效果')
    expect(html).toContain('给我一个默认效果的表达')
  })
  test('does not inherit expressions, resumes earlier expression turns, and disables referenced nodes', () => {
    const child = { ...root, id: '2', number: 2, parentId: '1', expressionMarkdown: undefined, expressionConversation: [{ id: 'expression-user', speaker: 'user', body: '之前调整表达的对话' }] }
    const html = render(child, [root, child])
    expect(html).not.toContain('已有表达')
    expect(html).toContain('之前调整表达的对话')
    expect(html).not.toContain('原始行动对话')
    expect(html).toContain('>表达</span>')
    expect(html).toContain('title="查看节点信息和操作"')
    expect(render(root, [root, child])).toContain('不可修改')
  })

  test('does not show the single action view when resolving expression context', () => {
    const primary = { ...root, agreementMarkdown: '记录静置结果', images: [{ url: '/expression-photo.jpg', alt: '上游表达配图' }] }
    const merged = { ...root, id: 'merged', number: 2, agreementMarkdown: '记录用时' }
    const node = { ...root, id: 'tip', number: 3, parentId: primary.id, mergedParentIds: [merged.id], objectiveMarkdown: '## 本次行动\n\n**十九分钟**', expressionMarkdown: undefined, agreementMarkdown: '后续记录锅具', referenceAgreements: [{ sourceId: merged.id, complies: false, exceptionReason: '没有计时' }] }
    const html = render(node, [primary, merged, node])
    expect(html).not.toContain('本次行动')
    expect(html).not.toContain('继承自 节点 #1')
    expect(html).not.toContain('alt="上游表达配图"')
    expect(html.match(/<textarea/g)).toHaveLength(1)
    expect(html).not.toContain('title="约定处理方式"')
  })
})
