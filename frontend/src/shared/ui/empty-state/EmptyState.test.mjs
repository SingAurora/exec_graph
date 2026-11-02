import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { EmptyState, EmptyStateIllustration } from './EmptyState.tsx'

describe('shared empty state', () => {
  test('renders a reusable illustration with title, description and optional action', () => {
    const html = renderToStaticMarkup(createElement(EmptyState, {
      title: '暂无表达',
      description: '路线终点还没有可展示的表达。',
      action: createElement('a', { href: '#projects' }, '去看看'),
    }))
    expect(html).toContain('<svg')
    expect(html).toContain('暂无表达')
    expect(html).toContain('路线终点还没有可展示的表达。')
    expect(html).toContain('去看看')
  })

  test('illustration can be reused without the wrapper', () => {
    const html = renderToStaticMarkup(createElement(EmptyStateIllustration))
    expect(html).toContain('<svg')
    expect(html).toContain('var(--signal)')
  })
})
