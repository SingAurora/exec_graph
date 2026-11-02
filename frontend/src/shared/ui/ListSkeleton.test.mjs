import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ListSkeleton } from './ListSkeleton.tsx'

describe('list skeleton', () => {
  test('renders the requested number of placeholder rows without business text', () => {
    const html = renderToStaticMarkup(createElement(ListSkeleton, { rows: 3 }))
    expect(html.match(/motion-safe:animate-pulse/g)).toHaveLength(3)
    expect(html).toContain('正在加载列表')
    expect(html).not.toContain('行动')
    expect(html).not.toContain('表达')
  })

  test('supports a compact variant and clamps the row count', () => {
    const html = renderToStaticMarkup(createElement(ListSkeleton, { rows: 99, compact: true }))
    expect(html.match(/motion-safe:animate-pulse/g)).toHaveLength(12)
    expect(html).toContain('size-8')
  })
})
