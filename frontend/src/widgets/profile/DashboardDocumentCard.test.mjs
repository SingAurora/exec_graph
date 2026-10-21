import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DashboardDocumentCard } from './DashboardDocumentCard.tsx'
import { RecordThumbnails } from '../../shared/ui/RecordThumbnails.tsx'

const source = {
  id: 'source', projectId: 'graph', number: 1, authorId: 'jo', title: '先试了一次',
  markdown: '第一次的行动', expressionMarkdown: '复做以后再判断是否适合自己。',
  images: [{ url: '/source.jpg', alt: '表达来源的图片' }], conversation: [], createdAt: '2026-10-01T12:00:00+08:00',
}
const current = {
  ...source, id: 'current', number: 2, parentId: 'source', title: '第二次复做',
  objectiveMarkdown: '这次换了锅，番茄炒软后再回蛋。', expressionMarkdown: undefined,
  images: [{ url: '/current.jpg', alt: '本次行动的图片' }],
}
const render = (mode) => renderToStaticMarkup(createElement(DashboardDocumentCard, {
  node: current, actions: [source, current], users: [], mode, onOpenNode() {}, onOpenProject() {},
}))

describe('dashboard document previews', () => {
  test('inherited expressions show their actual document and source image, without replacing them with current facts', () => {
    const html = render('expression')
    expect(html).toContain(source.expressionMarkdown)
    expect(html).toContain('src="/source.jpg"')
    expect(html).not.toContain(current.objectiveMarkdown)
    expect(html).not.toContain('src="/current.jpg"')
  })

  test('actions show the current facts and image independently of the inherited expression', () => {
    const html = render('objective')
    expect(html).toContain(current.objectiveMarkdown)
    expect(html).toContain('src="/current.jpg"')
    expect(html).not.toContain(source.expressionMarkdown)
    expect(html).not.toContain('src="/source.jpg"')
  })

  test('dashboard covers show one image while standard list previews retain three', () => {
    const images = Array.from({ length: 4 }, (_, index) => ({ url: `/image-${index}.jpg`, alt: `图片 ${index}` }))
    const cover = renderToStaticMarkup(createElement(RecordThumbnails, { images, size: 'cover' }))
    const gallery = renderToStaticMarkup(createElement(RecordThumbnails, { images }))
    expect(cover.match(/<img /g)).toHaveLength(1)
    expect(cover).toContain('还有 3 张图片')
    expect(gallery.match(/<img /g)).toHaveLength(3)
    expect(gallery).toContain('还有 1 张图片')
  })
})
