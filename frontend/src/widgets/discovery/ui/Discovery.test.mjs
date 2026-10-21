import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Discovery } from './Discovery.tsx'
import { RecentGraphsAside } from './RecentGraphsAside.tsx'
import { getActiveGraphActivities } from '../../../entities/project/lib/activity.ts'

const projects = Array.from({ length: 8 }, (_, index) => ({
  id: `g-${index}`, ownerId: 'jo', title: `图 ${index}`, description: '公开空间', createdAt: '2026-10-01T12:00:00+08:00',
}))
const actions = projects.flatMap((project, index) => {
  const base = { projectId: project.id, createdAt: `2026-10-${String(index + 1).padStart(2, '0')}T12:00:00+08:00`, images: [], conversation: [] }
  return [{ ...base, id: `source-${index}`, number: 1, authorId: 'lin', title: '来源行动', markdown: '真实行动', expressionMarkdown: '原来的表达', agreementMarkdown: '记录用时' },
    { ...base, id: `response-${index}`, number: 2, authorId: 'jo', title: `回应 ${index}`, markdown: '本次行动', expressionMarkdown: '目前的表达', parentId: `source-${index}`, referenceAgreements: [{ sourceId: `source-${index}`, complies: true }] }]
})
const render = (overrides = {}) => renderToStaticMarkup(createElement(Discovery, {
  projects, actions, users: [], active: true, onOpenProject() {}, onOpenNode() {}, onOpenReference() {}, onSearchGraphs() {}, ...overrides,
}))

describe('public discovery', () => {
  test('resolves current endpoints and satisfied exchanges with full context while excluding unknown graphs', () => {
    const html = render({ actions: [...actions, { ...actions[0], id: 'orphan', projectId: 'removed', expressionMarkdown: '不可见表达' }] })
    expect(html).toContain('aria-label="发现分类"')
    expect(html).toContain('trigger-agreements')
    expect(html).not.toContain('trigger-graphs')
    expect(html).not.toContain('content-graphs')
    expect(html).toContain('近期活跃的图')
    expect(html).not.toContain('trigger-actions')
    expect(html).not.toContain('content-actions')
    expect(html).not.toContain('aria-label="行动列表"')
    expect(html).toContain('data-reference-id="source-7:response-7"')
    expect(html).not.toContain('不可见表达')
    const expressionPanel = html.match(/id="[^"]*-content-expressions"[\s\S]*?(?=<div[^>]*id="[^"]*-content-agreements")/)?.[0] ?? ''
    expect(expressionPanel).toContain('目前的表达')
    expect(expressionPanel).not.toContain('原来的表达')
  })

  test('side directory shows only three recent graphs', () => {
    const items = getActiveGraphActivities(projects, actions)
    const aside = renderToStaticMarkup(createElement(RecentGraphsAside, { items, projects, actions, onOpen() {}, onSearchAll() {} }))
    expect(aside.match(/<button /g)).toHaveLength(3)
    expect(aside).toContain('图 7')
    expect(aside).not.toContain('图 4')
    expect(aside).toContain('aria-label="搜索图"')
  })

  test('empty discovery keeps every category with empty states and no invented activity', () => {
    const html = render({ projects: [], actions: [] })
    expect(html).toContain('暂无表达')
    expect(html).not.toContain('>暂无行动<')
    expect(html).toContain('暂无满足约定的跨用户引用')
    expect(html).not.toContain('暂无行动图')
    expect(html).toContain('暂无活跃的图')
    expect(html).not.toContain('data-node-id')
    expect(html).not.toContain('data-reference-id')
  })
})
