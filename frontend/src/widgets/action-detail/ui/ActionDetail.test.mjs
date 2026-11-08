import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ToastContext } from '../../../shared/ui/toast/ToastContext.ts'
import { ActionDetail } from './ActionDetail.tsx'

const noop = () => {}
const node = (number, parentId, expressionMarkdown, extra = {}) => ({ id: String(number), projectId: 'graph', number, parentId, expressionMarkdown, nodeReady: true, authorId: 'jo', title: `行动 ${number}`, markdown: '这次发生的事情', images: [], conversation: [], createdAt: '2026-10-18T12:00:00+08:00', ...extra })
function render(actions, id, props = {}) {
  return renderToStaticMarkup(createElement(ToastContext.Provider, { value: { showToast: noop } }, createElement(ActionDetail, {
    node: actions.find((item) => item.id === id), actions, users: [], recordMode: 'objective', isHighlightTip: false,
    onHighlight: noop, onHide: noop, onLocate: noop, onModeChange: noop, onOpenArchive: noop, onContinue: noop, onSelect: noop, onEditExpression: () => true, onEditAgreement: noop,
    ...props,
  })))
}

describe('node detail document tabs', () => {
  test('always shows the three parallel tabs and keeps continuation hidden until complete', () => {
    const html = render([{ ...node(1, undefined, ''), nodeReady: false, expressionStatus: 'pending', agreementStatus: 'pending' }], '1', { isAuthor: true })
    expect(html).toContain('>行动')
    expect(html).toContain('>表达')
    expect(html).toContain('>约定')
    expect(html).not.toContain('接续行动')
    expect(html).toContain('表达和约定都发布后，节点才能被接续')
    expect(html).not.toContain('补充表达')
    expect(html).not.toContain('修改表达')
    expect(html).not.toContain('补充约定')
    expect(html).not.toContain('修改约定')
  })

  test('shows a pending expression state instead of a false empty document', () => {
    const html = render([{ ...node(1, undefined, ''), nodeReady: false, expressionStatus: 'pending' }], '1', { recordMode: 'expression', isAuthor: true })
    expect(html).toContain('AI 正在生成表达草稿')
    expect(html).not.toContain('发布表达')
    expect(html).not.toContain('还没有表达')
  })

  test('shows an AI draft with a single edit action', () => {
    const html = render([{ ...node(1, undefined, ''), nodeReady: false, expressionStatus: 'draft' }], '1', {
      recordMode: 'expression', isAuthor: true,
      documents: [{ kind: 'expression', status: 'draft', draftMarkdown: '这是 AI 表达草稿' }],
      onRetryDocuments: async () => {}, onPublishDocument: async () => {},
    })
    expect(html).toContain('AI 草案 · 尚未发布')
    expect(html).toContain('这是 AI 表达草稿')
    expect(html).toContain('编辑表达')
    expect(html).not.toContain('重新生成')
    expect(html).not.toContain('>发布表达</button>')
    expect(html).not.toContain('AI 调整')
  })

  test('a non-author sees a waiting state rather than the private draft', () => {
    const html = render([{ ...node(1, undefined, ''), nodeReady: false, expressionStatus: 'draft' }], '1', { recordMode: 'expression', isAuthor: false })
    expect(html).toContain('作者正在完成表达，尚未发布')
    expect(html).not.toContain('>发布表达</button>')
    expect(html).not.toContain('AI 草案')
  })

  test('a published document is readable and a terminal node offers its contextual edit action', () => {
    const html = render([{ ...node(1, undefined, '已经发布的表达'), expressionStatus: 'published' }], '1', { recordMode: 'expression', isAuthor: true, terminal: true })
    expect(html).toContain('已经发布的表达')
    expect(html).toContain('编辑表达')
    expect(html).not.toContain('发布表达')
  })

  test('agreement tab includes the source agreement review below the own document', () => {
    const source = { ...node(1, undefined, ''), authorId: 'lin', agreementMarkdown: '记录总用时' }
    const child = { ...node(2, '1', ''), agreementMarkdown: '记录锅具', nodeReady: true, referenceAgreements: [{ sourceId: '1', complies: true }] }
    const html = render([source, child], '2', { recordMode: 'agreement', isAuthor: true, terminal: true })
    expect(html).toContain('记录锅具')
    expect(html).toContain('来源约定')
    expect(html).toContain('记录总用时')
  })

  test('collapses low-frequency node actions into a more menu', () => {
    const html = render([node(1, undefined, '表达')], '1', { terminal: true, canDelete: true, onDelete: noop })
    expect(html).toContain('title="更多操作"')
    expect(html).not.toContain('>查看形成过程</button>')
    expect(html).not.toContain('>版本历史</button>')
    expect(html).not.toContain('>删除节点</button>')
    expect(html).not.toContain('window.confirm')
  })
})
