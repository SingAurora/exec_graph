import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SidebarProfileCard } from './SidebarProfileCard.tsx'

const profile = { id: 'user /乔', name: '乔', email: 'qiao@example.com', bio: '记录做过的事情。', avatar: '', gender: 'unknown' }
const render = (overrides = {}) => renderToStaticMarkup(createElement(SidebarProfileCard, {
  profile, stats: { actions: 6, expressions: 2, agreements: 3 }, ...overrides,
}))

describe('sidebar profile shortcuts', () => {
  test('keeps account identity and sends each category to the matching own-profile tab', () => {
    const html = render()
    const href = '#profile?userId=' + encodeURIComponent(profile.id)
    expect(html).toContain('qiao@example.com')
    expect(html.split(`href="${href}"`)).toHaveLength(3)
    for (const [tab, label, count] of [['actions', '行动', 6], ['expressions', '表达', 2], ['agreements', '约定', 3]]) {
      expect(html).toContain(`href="${href}&amp;tab=${tab}"`)
      expect(html).toContain(`查看全部${label}，共 ${count} 条`)
    }
    expect(html).not.toContain('活跃天数')
    expect(html).not.toContain('完成记录')
  })

  test('keeps zero-count shortcuts and omits an unset biography without placeholder copy', () => {
    const html = render({ profile: { ...profile, bio: '   ' }, stats: { actions: 0, expressions: 0, agreements: 0 } })
    expect(html.match(/共 0 条/g)).toHaveLength(3)
    expect(html).not.toContain('<p')
    expect(html).toContain('qiao@example.com')
  })
})
