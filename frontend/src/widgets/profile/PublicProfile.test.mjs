import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PublicProfile } from './PublicProfile.tsx'
import { ProfileCover } from '../../entities/profile/ui/ProfileCover.tsx'
import { ToastContext } from '../../shared/ui/toast/ToastContext.ts'

const profile = { id: 'jo', name: '乔', avatar: '', bio: '', gender: 'unknown' }
const render = (patch = {}, props = {}) => renderToStaticMarkup(createElement(ToastContext.Provider, { value: { showToast() {} } }, createElement(PublicProfile, {
  profile: { ...profile, ...patch }, currentUserId: 'jo', following: false, users: [], projects: [], actions: [],
  onSetUserFollow() {}, onOpenProject() {}, onOpenNode() {}, onOpenReference() {},
  ...props,
})))

describe('profile header images', () => {
  test('the shared homepage has its content navigation, separate search categories and no retired overview', () => {
    const html = render({}, { onCreateProject() {} })
    expect(html).toContain('>首页</span>')
    expect(html).toContain('aria-label="行动热力图"')
    expect(html).toContain('aria-label="行动时间线"')
    expect(html).toContain('还没有行动记录')
    expect(html).toContain('发起行动图')
    expect(html).not.toContain('总览')
    expect(html).not.toContain('最近的图')
    expect(html).toContain('aria-label="主页搜索分类"')
    expect(html).toContain('>搜索</span>')
    expect(html.match(/role="tablist"/g)).toHaveLength(2)
    expect(html.match(/data-day-index=/g)).toHaveLength(365)
  })

  test('other public profiles use the same homepage without exposing graph creation', () => {
    const html = render({}, { currentUserId: 'other', onCreateProject() {} })
    expect(html).toContain('aria-label="行动热力图"')
    expect(html).not.toContain('发起行动图')
  })

  test('search forms and the counterpart selector stay inside the independent search panel', () => {
    const html = render()
    const searchStart = html.indexOf('aria-label="主页搜索"')
    expect(searchStart).toBeGreaterThan(0)
    const contentBeforeSearch = html.slice(0, searchStart)
    expect(contentBeforeSearch).not.toContain('type="search"')
    expect(contentBeforeSearch).not.toContain('往来对象')
    const search = html.slice(searchStart)
    expect(search.match(/type="search"/g)).toHaveLength(4)
    expect(search).toContain('aria-label="往来对象"')
    expect(search).not.toContain('找到 ')
  })

  test('shows the account email on the own homepage only', () => {
    expect(render({ email: 'qiao@example.com' })).toContain('qiao@example.com')
    expect(render({ email: 'qiao@example.com' }, { currentUserId: 'someone-else' })).not.toContain('qiao@example.com')
  })

  test('custom avatars and backgrounds open image previews rather than profile links', () => {
    const html = render({ avatar: '/avatar.jpg', backgroundImage: '/cover.jpg' })
    expect(html).toContain('src="/avatar.jpg"')
    expect(html).toContain('aria-label="查看图片：乔的头像"')
    expect(html).toContain('src="/cover.jpg"')
    expect(html).toContain('aria-label="查看图片：主页背景"')
    expect(html).not.toContain('href="#profile')
  })

  test('the default background supports preview while text avatars have no image trigger', () => {
    const html = render()
    expect(html).toContain('aria-label="查看图片：主页背景"')
    expect(html).not.toContain('aria-label="查看图片：乔的头像"')
    expect(html).toContain('>乔</span>')
  })

  test('sidebar and settings covers remain noninteractive by default', () => {
    for (const size of ['sidebar', 'preview']) {
      const html = renderToStaticMarkup(createElement(ProfileCover, { size }))
      expect(html).not.toContain('<button')
    }
  })
})
