import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ActionPostList } from './ActionPostList.tsx'

const noop = () => {}
const render = (props) => renderToStaticMarkup(createElement(ActionPostList, {
  nodes: [], actions: [], users: [], onExplore: noop, ...props,
}))

describe('empty graph lists', () => {
  test('the action list stays empty without duplicating the header creation entry', () => {
    const html = render({ mode: 'objective' })
    expect(html).toContain('暂无行动')
    expect(html).not.toContain('<button')
  })

  test('the expression list remains empty without an action creation prompt', () => {
    const html = render({ mode: 'expression' })
    expect(html).toContain('暂无表达')
    expect(html).not.toContain('<button')
  })
})

describe('shared feed document presentation', () => {
  const base = { projectId: 'g', authorId: 'lin', createdAt: '2026-10-21T12:00:00+08:00', images: [], conversation: [], markdown: '行动过程' }
  const root = { ...base, id: 'root', number: 1, title: '开始', expressionMarkdown: '先照顾食材的状态' }
  const branch = { ...base, id: 'branch', number: 2, title: '另一种试法', parentId: 'root' }
  const last = { ...base, id: 'last', number: 3, title: '今天做的饭', parentId: 'root', mergedParentIds: ['branch', 'root', 'missing'] }
  const actions = [root, branch, last]

  test('prioritizes effective expression over action title and counts distinct context actions including merges', () => {
    const html = render({ nodes: [last], actions, mode: 'expression', presentation: 'feed' })
    expect(html.indexOf('先照顾食材的状态')).toBeLessThan(html.indexOf('最近行动：'))
    expect(html).toContain('3 次行动支撑')
    expect(html).not.toContain('<h3')
    expect(html).not.toContain('第2层')
    expect(html).not.toContain('继承自')
  })

  test('credits another author when the endpoint inherits their expression', () => {
    const endpoint = { ...last, authorId: 'jo' }
    const html = render({ nodes: [endpoint], actions: [root, endpoint], mode: 'expression', presentation: 'feed', users: [{ id: 'lin', name: '林岚' }] })
    expect(html).toContain('沿用林岚的表达')
  })

  test('keeps graph list provenance and depth unchanged in the default presentation', () => {
    const html = render({ nodes: [last], actions, mode: 'expression' })
    expect(html).toContain('<h3')
    expect(html).toContain('第3层')
    expect(html).toContain('继承自')
    expect(html).not.toContain('次行动支撑')
  })
})
