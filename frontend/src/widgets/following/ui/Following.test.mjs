import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Following } from './Following.tsx'
import { Discovery } from '../../discovery/ui/Discovery.tsx'
import { followingKeys, followingTabKeys } from '../../../entities/following/api/following.ts'
import { TooltipProvider } from '../../../shared/ui/tooltip/Tooltip.tsx'
import { ToastContext } from '../../../shared/ui/toast/ToastContext.ts'

const noop = () => {}
const scope = 'jo'
const graphs = [{ uuid: 'cooking', id: 'cooking', title: '厨艺练习', createdAt: '2026-10-01' }]
const users = [{ uuid: 'lin', id: 'lin', name: '林', bio: '', avatar: '', gender: 'unknown' }, { uuid: 'miao', id: 'miao', name: '苗', bio: '', avatar: '', gender: 'unknown' }]
const node = (number, extra = {}) => ({ uuid: String(number), id: String(number), number, graphUuid: 'cooking', authorUuid: 'lin', title: `行动 ${number}`, markdown: '今天做了一盘炒蛋', images: [], conversation: [], createdAt: `2026-10-${String(number).padStart(2, '0')}T12:00:00+08:00`, ...extra })

const makeClient = ({ sources = { userUuids: [], graphUuids: [], users: [] }, expressions = { items: [], actions: [], graphs: [], total: 0, hasMore: false }, agreements = { items: [], actions: [], graphs: [], total: 0, hasMore: false }, graphPage = { items: [], total: 0 }, userPage = { items: [], total: 0 } } = {}) => {
  const client = new QueryClient()
  client.setQueryData(followingKeys.sources(scope), sources)
  client.setQueryData(followingTabKeys.expressions(scope), expressions)
  client.setQueryData(followingTabKeys.agreements(scope), agreements)
  client.setQueryData(followingTabKeys.graphs(scope), graphPage)
  client.setQueryData(followingTabKeys.users(scope), userPage)
  return client
}
const render = (data, initialTab) => renderToStaticMarkup(createElement(QueryClientProvider, { client: makeClient(data) },
  createElement(TooltipProvider, null, createElement(ToastContext.Provider, { value: { showToast: noop } }, createElement(Following, {
    scope, active: true, initialTab, onOpenGraph: noop, onOpenNode: noop, onOpenReference: noop, onSetGraphFollow: () => true, onSetUserFollow: () => true,
  })))))

describe('following navigation and empty states', () => {
  test('one tab bar prioritizes expressions and agreements without a separate action feed', () => {
    const html = render({}, 'expressions')
    expect(html.match(/role="tablist"/g)).toHaveLength(1)
    expect(html.match(/role="tab"/g)).toHaveLength(4)
    expect(html).not.toContain('trigger-actions')
    expect(html).not.toContain('content-actions')
    expect(html.match(/<button[^>]*data-state="active"[^>]*>/)?.[0]).toContain('trigger-expressions')
    expect(html).toContain('暂无数据')
  })

  test('following someone without publications shows the shared empty state on the active expressions tab', () => {
    const html = render({ sources: { userUuids: ['lin'], graphUuids: [], users: [users[0]] } }, 'expressions')
    expect(html).toContain('暂无数据')
  })

  test('an unfamiliar responder explains the followed author and still targets the actual arrow', () => {
    const actions = [node(1, { agreementMarkdown: '记录实际用时' }), node(2, { authorUuid: 'miao', parentUuid: '1', referenceAgreements: [{ sourceUuid: '1', complies: true }] })]
    const html = render({ sources: { userUuids: ['lin'], graphUuids: [], users: [users[0]] }, agreements: { items: ['2'], actions, graphs, total: 1, hasMore: false } }, 'agreements')
    expect(html).toContain('回应了你关注的')
    expect(html).toContain('data-reference-id="1:2"')
  })

  test('the same expression and agreement have identical items in discovery and following', () => {
    const actions = [
      node(1, { expressionMarkdown: '先照顾食材的状态', images: [{ url: '/egg.jpg', alt: '炒蛋' }], agreementMarkdown: '记录实际用时\n\n![配图](/agreement.jpg)' }),
      node(2, { authorUuid: 'miao', parentUuid: '1', referenceAgreements: [{ sourceUuid: '1', complies: true }] }),
    ]
    const sources = { userUuids: [], graphUuids: ['cooking'], users: users }
    const followingExpressions = render({ sources, userPage: { items: users, total: 2 }, expressions: { items: ['2'], actions, graphs, total: 1, hasMore: false } }, 'expressions')
    const followingAgreements = render({ sources, userPage: { items: users, total: 2 }, agreements: { items: ['2'], actions, graphs, total: 1, hasMore: false } }, 'agreements')
    const discovery = renderToStaticMarkup(createElement(QueryClientProvider, { client: new QueryClient() }, createElement(Discovery, {
      actions, graphs, users, active: true, onOpenNode: noop, onOpenReference: noop, onOpenGraph: noop, onSearchGraphs: noop,
    })))
    const item = (html, attribute, id) => html.match(new RegExp(`<article[^>]*${attribute}="${id}"[\\s\\S]*?</article>`))?.[0].replace(/radix-[^"]+/g, 'popover')
    expect(item(followingExpressions, 'data-node-id', '2')).toEqual(item(discovery, 'data-node-id', '2'))
    expect(item(followingAgreements, 'data-reference-id', '1:2')).toEqual(item(discovery, 'data-reference-id', '1:2'))
  })
})
