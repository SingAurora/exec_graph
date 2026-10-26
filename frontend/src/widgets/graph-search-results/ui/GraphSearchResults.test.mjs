import { describe, expect, test } from 'bun:test'
import { URLSearchParams } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { GraphSearchResults } from './GraphSearchResults.tsx'
import { GraphSearchResultsPage } from '../../../pages/GraphSearchResultsPage.tsx'

const projects = Array.from({ length: 12 }, (_, index) => ({ id: `g${index}`, ownerId: 'jo', title: `练习 ${String(index).padStart(2, '0')}`, description: '留下经验', createdAt: `2026-10-${String(index + 1).padStart(2, '0')}T12:00:00+08:00` }))
const props = { projects, actions: [], keyword: '练习', page: 1, onOpenProject() {}, onSearch() {}, onPageChange() {} }
const render = (extra = {}) => renderToStaticMarkup(createElement(GraphSearchResults, { ...props, ...extra }))

describe('full graph search results', () => {
  test('paginates the complete matching set rather than the sidebar preview', () => {
    const html = render()
    expect(html).toContain('找到 12 个图')
    expect(html).toContain('title="下一页"')
    const list = html.slice(html.indexOf('</form>'), html.indexOf('<nav'))
    expect(list.match(/<button /g)).toHaveLength(10)
    const second = render({ page: 2 })
    const secondText = second.replace(/<[^>]*>/g, '')
    expect(secondText).toContain('练习 01')
    expect(secondText).not.toContain('练习 11')
    expect(second.match(/<button[^>]*title="第 2 页"[^>]*>/)?.[0]).toContain('bg-signal-soft')
    expect(render({ page: 99 })).toEqual(second)
  })

  test('distinguishes no matches from a blank search without listing unrelated graphs', () => {
    expect(render({ keyword: '没有' })).toContain('没有找到相关图')
    const blank = render({ keyword: '' })
    expect(blank).toContain('输入图名称或简介搜索')
    expect(blank).not.toContain('练习 11')
    expect(blank).not.toContain('title="下一页"')
  })

  test('reads a shared search route and normalizes invalid or negative pages', () => {
    const html = renderToStaticMarkup(createElement(GraphSearchResultsPage, { ...props, params: new URLSearchParams('query=练习&page=-4') }))
    expect(html).toEqual(render())
    const invalid = renderToStaticMarkup(createElement(GraphSearchResultsPage, { ...props, params: new URLSearchParams('query=练习&page=oops') }))
    expect(invalid).toEqual(render())
  })
})
