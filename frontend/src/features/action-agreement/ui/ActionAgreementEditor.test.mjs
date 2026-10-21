import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ActionAgreementEditor } from './ActionAgreementEditor.tsx'

const render = (extra = {}) => renderToStaticMarkup(createElement(ActionAgreementEditor, {
  hasParent: true, inheritedAgreement: '原约定', draft: '修改后的约定', mode: 'inherit', onModeChange() {}, onDraftChange() {}, ...extra,
}))

describe('agreement choices before publishing', () => {
  test('revisions are editable while inherited conditions remain separately available', () => {
    const html = render({ mode: 'update' })
    expect(html).toContain('aria-label="本节点的约定"')
    expect(html).toContain('修改后的约定</textarea>')
    expect(html).toContain('原约定')
    expect(html).toContain('role="combobox"')
    expect(html).toContain('>修改约定</span>')
  })
  test('clearing removes downstream content without hiding the source conditions', () => {
    const html = render({ mode: 'clear' })
    expect(html).toContain('>清空约定</span>')
    expect(html).toContain('无约定')
    expect(html).toContain('本次引用的来源约定')
    expect(html).toContain('原约定')
    expect(html).not.toContain('aria-label="本节点的约定"')
  })
  test('the first action starts without conditions and offers setting an agreement', () => {
    const html = render({ hasParent: false, inheritedAgreement: '' })
    expect(html).toContain('暂不设置')
    expect(render({ hasParent: false, inheritedAgreement: '', mode: 'update' })).toContain('>设置约定</span>')
    expect(html).not.toContain('清空约定')
    expect(html).not.toContain('本次引用的来源约定')
  })
  test('reports noncompliance without approval and locks the draft during generation', () => {
    const html = render({ mode: 'update', disabled: true, sourceNodeNumber: 8, sourceReview: { complies: false, reason: '没有保留静置样本' } })
    expect(html).toContain('× 不满足约定')
    expect(html).toContain('不符合原因：没有保留静置样本')
    expect(html).toMatch(/<button[^>]*role="combobox"[^>]*disabled=""/)
    expect(html).toMatch(/<textarea[^>]*disabled=""/)
    expect(html).not.toContain('等待同意')
  })
})
