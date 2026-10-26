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
    expect(html).toContain('原始行动对话')
    expect(html).toContain('>修改表达</h2>')
    expect(html.match(/id="[^"]*-content-objective"[\s\S]*?<\/div>/)?.[0]).toContain('实际行动')
    expect(html).toContain('实际行动')
    expect(html).toContain('>本节点约定</h3>')
    expect(html).toContain('只读')
    expect(html).not.toContain('只读文档')
    expect(html.match(/<textarea/g)).toHaveLength(1)
    expect(html).toContain('表达对话内容')
    expect(html).toContain('trigger-conversation')
    expect(html).not.toContain('已有行动对话')
    expect(html.match(/原始行动对话/g)).toHaveLength(1)
    expect(html).toMatch(/<button[^>]+disabled=""[^>]*>[\s\S]*?保存表达<\/button>/)
    expect(html).not.toContain('发布行动节点')
    expect(html).not.toContain('清空表达</button>')
    expect(html).not.toContain('title="约定处理方式"')
    expect(html).not.toContain('grid-cols-')
  })
  test('resolves inherited expressions, resumes earlier expression turns, and disables referenced nodes', () => {
    const child = { ...root, id: '2', number: 2, parentId: '1', expressionMarkdown: undefined, expressionConversation: [{ id: 'expression-user', speaker: 'user', body: '之前调整表达的对话' }] }
    const html = render(child, [root, child])
    expect(html).toContain('已有表达')
    expect(html).toContain('之前调整表达的对话')
    expect(html.indexOf('原始行动对话')).toBeLessThan(html.indexOf('之前调整表达的对话'))
    expect(html).toContain('历史 1 个节点')
    expect(render(root, [root, child])).toContain('该节点已有后续引用，无法修改表达')
    expect(render({ ...root, expressionMarkdown: '' })).toContain('补充表达')
  })

  test('keeps published facts and multiple source agreements read-only while resolving expression images', () => {
    const primary = { ...root, agreementMarkdown: '记录静置结果', images: [{ url: '/expression-photo.jpg', alt: '上游表达配图' }] }
    const merged = { ...root, id: 'merged', number: 2, agreementMarkdown: '记录用时' }
    const node = { ...root, id: 'tip', number: 3, parentId: primary.id, mergedParentIds: [merged.id], objectiveMarkdown: '## 本次行动\n\n**十九分钟**', expressionMarkdown: undefined, agreementMarkdown: '后续记录锅具', referenceAgreements: [{ sourceId: merged.id, complies: false, exceptionReason: '没有计时' }] }
    const html = render(node, [primary, merged, node])
    expect(html).toContain('<h2>本次行动</h2>')
    expect(html).toContain('<strong>十九分钟</strong>')
    expect(html).toContain('继承自 节点 #1')
    expect(html).toContain('alt="上游表达配图"')
    expect(html).toContain('后续记录锅具')
    expect(html).toContain('记录静置结果')
    expect(html).toContain('记录用时')
    expect(html).toContain('× 不满足约定')
    expect(html).toContain('不符合原因：没有计时')
    expect(html).toContain('尚未核对')
    expect(html.match(/<textarea/g)).toHaveLength(1)
    expect(html).not.toContain('title="约定处理方式"')
  })
})
