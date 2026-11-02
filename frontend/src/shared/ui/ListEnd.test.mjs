import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ListEnd } from './ListEnd.tsx'

describe('shared list end marker', () => {
  test('shows a spinner and loading label while more items can load', () => {
    const html = renderToStaticMarkup(createElement(ListEnd, { hasMore: true }))
    expect(html).toContain('加载中…')
    expect(html).toContain('animate-spin')
  })

  test('shows only the completion label when exhausted', () => {
    const html = renderToStaticMarkup(createElement(ListEnd, { hasMore: false }))
    expect(html).toContain('没有更多了')
    expect(html).not.toContain('lucide-check')
    expect(html).not.toContain('rounded-full')
  })

  test('accepts a list-specific completion label', () => {
    const html = renderToStaticMarkup(createElement(ListEnd, { hasMore: false, doneLabel: '已显示全部可选表达' }))
    expect(html).toContain('已显示全部可选表达')
  })
})
