import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ToastContext } from '../../../shared/ui/toast/ToastContext.ts'
import { ActionDetail } from './ActionDetail.tsx'

const noop = () => {}
const node = (number, parentId, expressionMarkdown) => ({ id: String(number), projectId: 'graph', number, parentId, expressionMarkdown, authorId: 'jo', title: `行动 ${number}`, markdown: '这次发生的事情', images: [], conversation: [], createdAt: '2026-10-18T12:00:00+08:00' })
function render(actions, id, recordMode = 'expression') {
  return renderToStaticMarkup(createElement(ToastContext.Provider, { value: { showToast: noop } }, createElement(ActionDetail, {
    node: actions.find((item) => item.id === id), actions, users: [], recordMode, branches: [], isHighlightTip: false,
    onHighlight: noop, onHide: noop, onLocate: noop, onModeChange: noop, onOpenArchive: noop, onContinue: noop, onSelect: noop, onEditExpression: () => true, onUpdateAgreement: () => true,
  })))
}
const switches = (html) => html.match(/<div class="flex items-center gap-5">([\s\S]*?)<\/div>/)?.[1] ?? ''

describe('detail expression controls', () => {
  test('an empty endpoint offers agreement supplementation in its own section rather than the primary action row', () => {
    const html = render([node(1, undefined, '')], '1')
    expect(html).toContain('补充表达')
    expect(html).toContain('补充约定')
    expect(html.indexOf('补充约定')).toBeGreaterThan(html.indexOf('</footer>'))
    expect(html.indexOf('补充约定')).toBeGreaterThan(html.indexOf('>约定</span>'))
    expect(html).not.toContain('保存约定')
    expect(html).not.toContain('<textarea')
    expect(html).not.toContain('保存表达')
  })

  test('existing or inherited agreements offer modification only at endpoints', () => {
    const root = { ...node(1), agreementMarkdown: '已有约定' }
    expect(render([root], '1')).toContain('修改约定')
    expect(render([root, node(2, '1')], '2')).toContain('修改约定')
    for (const child of [node(2, '1'), { ...node(2), mergedParentIds: ['1'] }]) {
      const html = render([root, child], '1')
      expect(html).not.toContain('补充约定')
      expect(html).not.toContain('修改约定')
    }
  })
  test('places both agreement sections below the document and action controls, outside the header', () => {
    const actions = [{ ...node(1), agreementMarkdown: '记录总用时' }, node(2, '1')]
    const html = render(actions, '2')
    const sourceIndex = html.indexOf('>来源约定 ')
    expect(sourceIndex).toBeGreaterThan(html.indexOf('查看形成过程'))
    expect(sourceIndex).toBeGreaterThan(html.indexOf('</footer>'))
    expect(html.indexOf('>约定</span>')).toBeGreaterThan(html.indexOf('</footer>'))
    expect(html.slice(0, html.indexOf('</header>'))).not.toContain('来源约定')
  })
  test('an empty non-endpoint hides expression and supplement controls, even when expression was selected', () => {
    const html = render([node(1, undefined, ''), node(2, '1')], '1')
    expect(switches(html)).not.toContain('>表达</button>')
    expect(html).not.toContain('补充表达')
    expect(html).not.toContain('修改表达')
    expect(html).not.toContain('暂无表达')
    expect(html).toContain('这次发生的事情')
  })

  test('an empty endpoint puts the supplement directly after continuation and still hides expression', () => {
    const html = render([node(1, undefined, '')], '1')
    expect(switches(html)).not.toContain('>表达</button>')
    expect(html.indexOf('接续行动')).toBeLessThan(html.indexOf('补充表达'))
    expect(html.indexOf('补充表达')).toBeLessThan(html.indexOf('查看形成过程'))
  })

  test('inherited and modified expressions remain readable with a clickable origin', () => {
    const actions = [node(1, undefined, '最早的表达'), node(2, '1'), node(3, '2', '修改后的表达')]
    const inherited = render(actions, '2')
    expect(switches(inherited)).toContain('>表达</button>')
    expect(inherited).toContain('继承自')
    expect(inherited).toContain('查看表达来源节点 #1')
    expect(inherited).not.toContain('补充表达')
    const modified = render(actions, '3')
    expect(modified).toContain('修改自')
    expect(modified).toContain('查看表达来源节点 #1')
    expect(modified).toContain('修改后的表达')
    expect(modified).toContain('修改表达')
    expect(inherited).not.toContain('修改表达')
    const inheritedEndpoint = render(actions.slice(0, 2), '2')
    expect(inheritedEndpoint).toContain('修改表达')
    expect(inheritedEndpoint).not.toContain('补充表达')
  })
})
