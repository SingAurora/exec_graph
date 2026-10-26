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
    expect(html).not.toContain('编辑精选')
  })

  test('only shows deliberately selected owned documents and hides cleared or deleted versions', () => {
    const actions = [
      { id: 'own', authorId: 'jo', projectId: 'cooking', number: 1, title: '一次试做', expressionMarkdown: '多花三分钟值得', agreementMarkdown: '请记录锅具', createdAt: '2026-10-01' },
      { id: 'other', authorId: 'lin', projectId: 'cooking', number: 2, title: '别人的试做', expressionMarkdown: '不应自动精选这条', createdAt: '2026-10-02' },
    ].map((node) => ({ ...node, markdown: '', images: [], conversation: [] }))
    // 兼容旧资料中的独立约定字段，但不再展示它。
    const highlights = { expressionNodeIds: ['own', 'other', 'deleted'], agreementNodeIds: ['other'] }
    const html = render({ highlights }, { actions, currentUserId: 'visitor' })
    const start = html.indexOf('aria-label="主页精选"')
    const selected = html.slice(start, html.indexOf('aria-label="行动热力图"', start))
    expect(selected).toContain('多花三分钟值得')
    expect(selected).toContain('请记录锅具')
    expect(selected).not.toContain('不应自动精选这条')
    expect(selected).not.toContain('编辑精选')
    expect(selected).not.toContain('精选约定')
    const cleared = render({ highlights }, { actions: [{ ...actions[0], expressionMarkdown: '', agreementMarkdown: '' }], currentUserId: 'visitor' })
    expect(cleared).not.toContain('aria-label="主页精选"')
  })

  test('keeps saved expression order and attaches the selected branch agreement with its author', () => {
    const actions = [
      { id: 'source', authorId: 'lin', agreementMarkdown: '请记录实际用时', number: 1 },
      { id: 'first', authorId: 'jo', parentId: 'source', expressionMarkdown: '表达甲', number: 2 },
      { id: 'second', authorId: 'jo', expressionMarkdown: '表达乙', agreementMarkdown: '', number: 3 },
    ].map((node) => ({ projectId: 'cooking', title: node.id, createdAt: '2026-10-01', markdown: '', images: [], conversation: [], ...node }))
    const html = render({ highlights: { expressionNodeIds: ['second', 'first'] } }, { actions, users: [{ id: 'lin', name: '林', avatar: '' }], currentUserId: 'visitor' })
    const start = html.indexOf('aria-label="主页精选"')
    const selected = html.slice(start, html.indexOf('aria-label="行动热力图"', start))
    expect(selected.indexOf('表达乙')).toBeLessThan(selected.indexOf('表达甲'))
    expect(selected).toContain('请记录实际用时')
    expect(selected).toContain('林')
    expect(selected.match(/aria-label="分支约定"/g)).toHaveLength(1)
    expect(selected).not.toContain('添加表达')
  })

  test('highlight previews retain feed context and separate expression and agreement image previews', () => {
    const actions = [{ id: 'own', authorId: 'jo', projectId: 'cooking', number: 1, title: '实际行动标题', expressionMarkdown: '来自行动的表达', agreementMarkdown: '请记录用时\n\n![约定配图](/agreement.jpg)', createdAt: '2026-10-01', markdown: '', images: [{ url: '/expression.jpg', alt: '表达配图' }], conversation: [] }]
    const html = render({ highlights: { expressionNodeIds: ['own'] } }, { actions, currentUserId: 'visitor' })
    const start = html.indexOf('aria-label="主页精选"')
    const selected = html.slice(start, html.indexOf('aria-label="行动热力图"', start))
    expect(selected).toContain('最近行动：')
    expect(selected).toContain('1 次行动支撑')
    expect(selected).toContain('aria-label="查看图片：表达配图"')
    expect(selected).toContain('aria-label="查看图片：约定配图"')
    expect(selected).toContain('aria-label="查看分支约定的行动背景：实际行动标题"')
    expect(selected).not.toContain('展开表达全文')
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
