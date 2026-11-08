import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ActionWorkspace } from './ActionWorkspace.tsx'

const noop = () => {}
const render = (props) => renderToStaticMarkup(createElement(ActionWorkspace, {
  profileName: '乔', onBack: noop, onConfirm: noop, ...props,
}))

describe('action workspace', () => {
  test('a root records only action facts', () => {
    const html = render({ hasParent: false })
    expect(html).toContain('>记录行动</h2>')
    expect(html).toContain('>行动</span>')
    expect(html).toContain('trigger-conversation')
    expect(html.match(/<textarea/g)).toHaveLength(1)
    expect(html).toContain('先说说这次实际做了什么')
    expect(html).toContain('>AI 对话</span>')
    expect(html).toContain('>行动</span>')
    expect(html).toContain('title="发送"')
    expect(html).toContain('title="复制当前对话内容"')
    expect(html).not.toContain('>发布行动</button>')
    expect(html).not.toContain('之后发生的行动')
  })

  test('switches between the conversation composer and the image composer', () => {
    const html = render({ hasParent: false })
    expect(html).toContain('>文字</button>')
    expect(html).toContain('>图片</button>')
    expect(html).toContain('title="发送"')
    expect(html).not.toContain('添加图片')
  })

  test('shows the three verification states in the tab strip, not a technical draft state', () => {
    const html = render({ hasParent: false })
    expect(html).toContain('>未核验</span>')
    expect(html).not.toContain('切换到「行动」')
    expect(html).not.toContain('本轮未完成')
    expect(html).not.toContain('草稿已生成')
  })

  test('renders a retained AI clarification from a saved conversation', () => {
    const html = render({ hasParent: false, initialMessages: [
      { id: 'notice-1', speaker: 'ai', body: '请补充这次实际做了什么、过程、结果或明确感受' },
    ] })
    expect(html).toContain('请补充这次实际做了什么、过程、结果或明确感受')
  })

  test('a continuation keeps only action tabs while retaining its source context', () => {
    const html = render({ hasParent: true, contextTitle: '先把鸡蛋盛出来', sourceNodeNumber: 8, expressionSourceNumber: 2, inheritedExpression: '先盛蛋减少等待', inheritedExpressionImages: [{ url: '/inherited-meal.jpg', alt: '继承表达的配图' }], historyFacts: [{ number: 8, title: '先把鸡蛋盛出来', authorId: 'lin', markdown: '行动记录' }] })
    expect(html).toContain('承接 #8')
    expect(html).toContain('title="查看节点信息和操作"')
    expect(html).toContain('>AI 对话</span>')
    expect(html).toContain('>行动</span>')
  })

  test('a continuation does not expose agreement editing in the action workspace', () => {
    const html = render({ hasParent: true, inheritedAgreement: '记录总用时', sourceNodeNumber: 8 })
    expect(html).not.toContain('记录总用时')
    expect(html).not.toContain('约定处理方式')
  })

  test('a continuation with no inherited documents keeps both previews empty', () => {
    const html = render({ hasParent: true, sourceNodeNumber: 3 })
    expect(html).not.toContain('继承自 节点 #3')
  })

  test('previews real Markdown without a second document heading or nested scrolling renderer', () => {
    const html = render({ hasParent: true, initialDocument: '## 本次行动\n\n**观察**\n\n| 条件 | 结果 |\n| --- | --- |\n| 换锅 | 蛋偏硬 |' })
    expect(html).toContain('<h2>本次行动</h2>')
    expect(html).toContain('<strong>观察</strong>')
    expect(html).toContain('<table>')
    expect(html).not.toContain('只读文档')
    expect(html.match(/id="[^"]*-content-objective"[\s\S]*?<\/section>/)?.[0]).toContain('<h2>本次行动</h2>')
  })

  test('shows the agreement summary only for another user\'s inherited node', () => {
    const parent = { id: 'p', projectId: 'graph', number: 8, title: '先盛蛋', markdown: '实际行动', authorId: 'lin', agreementMarkdown: '记录实际用时' }
    const html = render({ profile: { id: 'jo', name: '乔' }, actions: [parent], hasParent: true, sourceNodeId: 'p', sourceNodeNumber: 8, inheritedAgreement: '记录实际用时' })
    expect(html).toContain('约定 0/1 满足')
    expect(html).toContain('1 未知')
    expect(html).toContain('title="查看约定核对详情"')
  })

  test('does not offer merge background or treat own source as a review', () => {
    const parent = { id: 'p', projectId: 'graph', number: 2, title: '先盛蛋', markdown: '实际行动', authorId: 'jo', agreementMarkdown: '记录锅温' }
    const props = { profile: { id: 'jo', name: '乔' }, actions: [parent], sourceNodeId: 'p', sourceNodeNumber: 2, inheritedAgreement: '记录锅温' }
    const html = render({ ...props, hasParent: true })
    expect(html).not.toContain('合入节点')
    expect(html).toContain('承接 #2')
    expect(html).not.toContain('约定 0/1 满足')
  })
})
