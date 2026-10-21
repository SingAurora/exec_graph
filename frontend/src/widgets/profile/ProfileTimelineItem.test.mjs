import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProfileTimelineItem } from './ProfileTimelineItem.tsx'

describe('compact profile timeline', () => {
  test('shows the action summary below its title, keeping expressions and images out of the log', () => {
    const html = renderToStaticMarkup(createElement(ProfileTimelineItem, {
      node: { id: 'a', title: '做了第一盘番茄炒蛋', createdAt: new Date(2026, 9, 21, 19, 30).toISOString(),
        markdown: '不应该显示的旧记录', objectiveMarkdown: '# 做了第一盘番茄炒蛋\n\n**番茄切小块**，鸡蛋炒好先盛出。\n![成品](/food.jpg)', expressionMarkdown: '不应该显示的表达', images: [{ url: '/food.jpg', alt: '成品' }] },
      onOpenNode() {},
    }))
    expect(html).toContain('做了第一盘番茄炒蛋')
    expect(html).toContain('19:30')
    expect(html).toContain('<time')
    expect(html).toContain('番茄切小块，鸡蛋炒好先盛出。')
    expect(html.match(/<button/g)).toHaveLength(1)
    expect(html).not.toContain('不应该显示')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('写下表达')
    expect(html).not.toContain('约定')
  })
})
