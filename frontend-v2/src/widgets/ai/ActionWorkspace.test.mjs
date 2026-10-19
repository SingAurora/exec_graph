import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ActionWorkspace } from './ActionWorkspace.tsx'

const noop = () => {}
const render = (props) => renderToStaticMarkup(createElement(ActionWorkspace, {
  profileName: '乔', onBack: noop, onConfirm: noop, ...props,
}))

describe('first action expression options', () => {
  test('a root uses one conversation and two read-only documents, with an empty initial expression', () => {
    const html = render({ hasParent: false })
    expect(html).toContain('表达为空')
    expect(html).toContain('aria-label="接续行动工作区"')
    expect(html).toContain('aria-label="连续 AI 对话"')
    expect(html.match(/<textarea/g)).toHaveLength(1)
    expect(html).not.toContain('aria-label="本节点的表达"')
    expect(html).not.toContain('继承自 节点')
    expect(html).not.toContain('清空表达')
    expect(html).toContain('先说说这次实际做了什么，也可以一起聊聊你的看法。')
    expect(html).not.toContain('之后发生的行动')
  })

  test('a continuation still defaults to inheritance and previews its upstream expression', () => {
    const html = render({ hasParent: true, contextTitle: '先把鸡蛋盛出来', sourceNodeNumber: 8, expressionSourceNumber: 2, inheritedExpression: '先盛蛋减少等待', inheritedExpressionImages: [{ url: '/inherited-meal.jpg', alt: '继承表达的配图' }], historyFacts: [{ number: 8, title: '先把鸡蛋盛出来', authorId: 'lin', markdown: '行动记录' }] })
    expect(html).toContain('继承自 节点 #2')
    expect(html).toContain('承接 #8')
    expect(html).toContain('历史 1 个节点')
    expect(html).not.toContain('aria-label="表达处理方式"')
    expect(html).toContain('先盛蛋减少等待')
    expect(html).toContain('alt="继承表达的配图"')
    expect(html).not.toContain('暂不填写')
  })

  test('a continuation inherits the agreement independently and keeps source conditions at the bottom', () => {
    const html = render({ hasParent: true, inheritedAgreement: '记录总用时', sourceNodeNumber: 8 })
    expect(html).toContain('aria-label="设置本节点约定"')
    expect(html).toContain('aria-label="约定处理方式"')
    expect(html).toContain('role="combobox"')
    expect(html).toContain('>沿用上个节点</span>')
    expect(html).toContain('记录总用时')
    expect(html.indexOf('aria-label="本次引用的来源约定"')).toBeGreaterThan(html.indexOf('aria-label="设置本节点约定"'))
    expect(html).not.toContain('aria-label="本节点的约定"')
    expect(html).toContain('尚未核对')
  })

  test('a continuation of an empty expression and agreement stays empty and offers setting an agreement', () => {
    const html = render({ hasParent: true, sourceNodeNumber: 3 })
    expect(html).toContain('表达为空')
    expect(html).not.toContain('继承自 节点 #3')
    expect(html).toContain('>不设置约定</span>')
    expect(html).not.toContain('修改约定')
    expect(html).not.toContain('清空约定')
    expect(html).not.toContain('aria-label="本次引用的来源约定"')
  })

  test('previews real Markdown without a second document heading or nested scrolling renderer', () => {
    const html = render({ hasParent: true, initialDocument: '## 本次行动\n\n**观察**\n\n| 条件 | 结果 |\n| --- | --- |\n| 换锅 | 蛋偏硬 |' })
    expect(html).toContain('<h2>本次行动</h2>')
    expect(html).toContain('<strong>观察</strong>')
    expect(html).toContain('<table>')
    expect(html).not.toContain('只读文档')
    expect(html).toContain('aria-label="行动文档预览"')
  })

  test('offers merge selection only for a continuation, keeping initial source compliance unknown', () => {
    const parent = { id: 'p', projectId: 'graph', number: 2, title: '先盛蛋', markdown: '实际行动', authorId: 'lin', agreementMarkdown: '记录锅温' }
    const props = { actions: [parent], sourceNodeId: 'p', sourceNodeNumber: 2, inheritedAgreement: '记录锅温' }
    const html = render({ ...props, hasParent: true })
    expect(html).toContain('合入节点')
    expect(html).toContain('承接 #2')
    expect(html).toContain('尚未核对')
    expect(render({ ...props, hasParent: false })).not.toContain('合入节点')
  })
})
