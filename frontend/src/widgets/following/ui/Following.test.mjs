import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Following } from './Following.tsx'
import { Discovery } from '../../discovery/ui/Discovery.tsx'
import { TooltipProvider } from '../../../shared/ui/tooltip/Tooltip.tsx'
import { ToastContext } from '../../../shared/ui/toast/ToastContext.ts'

const noop = () => {}
const projects = [{ id: 'cooking', title: '厨艺练习', createdAt: '2026-10-01' }]
const users = [{ id: 'lin', name: '林', bio: '', avatar: '', gender: 'unknown' }, { id: 'miao', name: '苗', bio: '', avatar: '', gender: 'unknown' }]
const node = (number, extra = {}) => ({ id: String(number), number, projectId: 'cooking', authorId: 'lin', title: `行动 ${number}`, markdown: '今天做了一盘炒蛋', images: [], conversation: [], createdAt: `2026-10-${String(number).padStart(2, '0')}T12:00:00+08:00`, ...extra })
const render = (sources, actions = []) => renderToStaticMarkup(createElement(TooltipProvider, null,
  createElement(ToastContext.Provider, { value: { showToast: noop } }, createElement(Following, {
    sources, actions, active: true, projects, users,
    onOpenProject: noop, onOpenNode: noop, onOpenReference: noop, onSetGraphFollow: () => true, onSetUserFollow: () => true,
  }))))

describe('following navigation and empty states', () => {
  test('one tab bar prioritizes expressions and agreements without a separate action feed', () => {
    const html = render({ userIds: [], graphIds: [] })
    expect(html.match(/role="tablist"/g)).toHaveLength(1)
    expect(html.match(/role="tab"/g)).toHaveLength(4)
    expect(html).not.toContain('trigger-actions')
    expect(html).not.toContain('content-actions')
    expect(html.match(/<button[^>]*data-state="active"[^>]*>/)?.[0]).toContain('trigger-expressions')
    expect(html).not.toContain('动态分类')
    expect(html).toContain('还没有关注的图或用户')
    expect(html).toContain('去发现')
  })

  test('following someone without publications gives category-specific empty states', () => {
    const html = render({ userIds: ['lin'], graphIds: [] })
    expect(html).toContain('关注的用户和图暂无表达')
    expect(html).toContain('关注的用户和图暂无约定回应')
    expect(html).not.toContain('还没有关注的图或用户')
    expect(html).toContain('搜索关注的用户')
  })

  test('an unfamiliar responder explains the followed author and still targets the actual arrow', () => {
    const html = render({ userIds: ['lin'], graphIds: [] }, [
      node(1, { agreementMarkdown: '记录实际用时' }),
      node(2, { authorId: 'miao', parentId: '1', referenceAgreements: [{ sourceId: '1', complies: true }] }),
    ])
    expect(html).toContain('回应了你关注的')
    expect(html).toContain('查看林的资料')
    expect(html).toContain('data-reference-id="1:2"')
    expect(html).toContain('查看约定回应：节点 #1 → #2')
  })

  test('the same expression and agreement have identical items in discovery and following', () => {
    const actions = [
      node(1, { expressionMarkdown: '先照顾食材的状态', images: [{ url: '/egg.jpg', alt: '炒蛋' }], agreementMarkdown: '记录实际用时\n\n![配图](/agreement.jpg)' }),
      node(2, { authorId: 'miao', parentId: '1', referenceAgreements: [{ sourceId: '1', complies: true }] }),
    ]
    const following = render({ userIds: [], graphIds: ['cooking'] }, actions)
    const discovery = renderToStaticMarkup(createElement(Discovery, {
      actions, projects, users, active: true, onOpenNode: noop, onOpenReference: noop, onOpenProject: noop, onSearchGraphs: noop,
    }))
    const item = (html, attribute, id) => html.match(new RegExp(`<article[^>]*${attribute}="${id}"[\\s\\S]*?</article>`))?.[0].replace(/radix-[^"]+/g, 'popover')
    const expression = item(following, 'data-node-id', '2')
    const agreement = item(following, 'data-reference-id', '1:2')
    expect(expression).toContain('沿用林的表达')
    expect(expression).toContain('2 次行动支撑')
    expect(expression).not.toContain('<h3')
    expect(expression).not.toContain('第2层')
    expect(expression).toEqual(item(discovery, 'data-node-id', '2'))
    expect(agreement).toContain('/agreement.jpg')
    expect(agreement).toEqual(item(discovery, 'data-reference-id', '1:2'))
  })
})
