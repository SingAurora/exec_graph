import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PersonalWorkspace } from './PersonalWorkspace.tsx'

const profile = { id: 'jo', name: '乔', avatar: '' }
const projects = Array.from({ length: 5 }, (_, index) => ({ id: `graph-${index}`, ownerId: 'jo', title: `厨艺 ${index}`, description: '图简介', createdAt: '2026-10-01T12:00:00+08:00' }))
const actions = projects.flatMap((project, index) => {
  const base = { projectId: project.id, images: [], conversation: [], createdAt: `2026-10-${String(index + 1).padStart(2, '0')}T12:00:00+08:00` }
  return [
    { ...base, id: `source-${index}`, number: 1, authorId: 'lin', title: '来源行动', markdown: '来源事实', agreementMarkdown: '记录实际用时' },
    { ...base, id: `response-${index}`, number: 2, authorId: 'jo', title: `行动 ${index}`, markdown: '本次行动事实', parentId: `source-${index}`, expressionMarkdown: '做过再表达', referenceAgreements: [{ sourceId: `source-${index}`, complies: true }] },
  ]
})
const render = (overrides = {}) => renderToStaticMarkup(createElement(PersonalWorkspace, {
  profile, users: [profile, { id: 'lin', name: '林岚', avatar: '' }], projects, actions,
  onCreateProject() {}, onOpenProject() {}, onOpenNode() {}, onOpenReference() {}, ...overrides,
}))

describe('personal overview', () => {
  test('caps each recent category at three while totals and shortcuts cover all personal content', () => {
    const html = render()
    expect(html.match(/data-node-id="response-/g)).toHaveLength(6)
    expect(html.match(/data-reference-id="source-/g)).toHaveLength(3)
    expect(html.match(/查看全部(?:行动|表达|约定)，共 5 条/g)).toHaveLength(3)
    expect(html).toContain('查看全部图，共 5 个')
    expect(html.match(/href="#profile\?userId=jo&amp;tab=agreements"/g)).toHaveLength(2)
    expect(html).not.toContain('response-0')
    expect(html).not.toContain('图简介')
    expect(html.indexOf('最近行动')).toBeLessThan(html.indexOf('最近表达'))
  })

  test('counts and previews agreements where others satisfy the profile author too', () => {
    const reversed = actions.map((node) => ({ ...node, authorId: node.authorId === 'jo' ? 'lin' : 'jo' }))
    const html = render({ actions: reversed })
    expect(html).toContain('查看全部约定，共 5 条')
    expect(html).toContain('查看林岚的主页')
    expect(html.match(/data-reference-id="source-/g)).toHaveLength(3)
  })

  test('empty accounts keep all entry points without inventing activity or exchanges', () => {
    const html = render({ projects: [], actions: [] })
    expect(html).toContain('还没有行动记录')
    expect(html).toContain('还没有表达')
    expect(html).toContain('暂无约定交流')
    expect(html).toContain('还没有参与或发起的行动图')
    expect(html).toContain('发起行动图')
    expect(html).toContain('查看全部约定，共 0 条')
    expect(html).not.toContain('data-reference-id')
  })
})
