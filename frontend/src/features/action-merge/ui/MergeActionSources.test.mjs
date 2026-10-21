import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MergeActionSources } from './MergeActionSources.tsx'

const node = (number, extra = {}) => ({ id: String(number), projectId: 'graph', number, authorId: 'jo', title: `行动 ${number}`, markdown: '行动记录', images: [], conversation: [], ...extra })
const render = (actions, selectedIds) => renderToStaticMarkup(createElement(MergeActionSources, {
  actions, parentId: '1', selectedIds, reviews: [], disabled: false, onChange: () => {},
}))

describe('merge source eligibility display', () => {
  test('keeps a stale selection visible and removable instead of silently accepting or dropping it', () => {
    const html = render([node(1), node(2), node(3, { parentId: '2' })], ['2'])
    expect(html).toContain('已非终端')
    expect(html).toContain('aria-label="移除合入节点 #2"')
    expect(html).not.toContain('满足约定')
  })

  test('an eligible endpoint retains its normal agreement status', () => {
    const html = render([node(1), node(2)], ['2'])
    expect(html).toContain('无约定')
    expect(html).not.toContain('已非终端')
  })
})
