import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MarkdownContent } from './MarkdownContent.tsx'

const render = (markdown, images = []) => renderToStaticMarkup(createElement(MarkdownContent, { markdown, images }))
const imageSources = (html) => [...html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map((match) => match[1])

describe('document images', () => {
  test('keeps inline images between the original paragraphs and appends unattached images', () => {
    const html = render('开始\n\n![过程](/inline.jpg)\n\n结束', [
      { url: '/inline.jpg', alt: '过程' }, { url: '/extra.jpg', alt: '附图' },
    ])
    expect(imageSources(html)).toEqual(['/inline.jpg', '/extra.jpg'])
    expect(html.indexOf('开始')).toBeLessThan(html.indexOf('src="/inline.jpg"'))
    expect(html.indexOf('src="/inline.jpg"')).toBeLessThan(html.indexOf('结束'))
    expect(html.indexOf('结束')).toBeLessThan(html.indexOf('src="/extra.jpg"'))
  })

  test('recognizes reference-style images without appending them a second time', () => {
    const html = render('![过程][Photo]\n\n[photo]: /reference.jpg', [{ url: '/reference.jpg', alt: '附件' }])
    expect(imageSources(html)).toEqual(['/reference.jpg'])
  })

  test('an ordinary link does not suppress an image attachment', () => {
    expect(imageSources(render('[原图](/photo.jpg)', [{ url: '/photo.jpg', alt: '附图' }]))).toEqual(['/photo.jpg'])
  })

  test('preserves intentionally repeated images and attachment order', () => {
    const images = [{ url: '/same.jpg', alt: '第一张' }, { url: '/same.jpg', alt: '第二张' }]
    expect(imageSources(render('正文', images))).toEqual(['/same.jpg', '/same.jpg'])
    expect(imageSources(render('![第一张](/same.jpg) ![第二张](/same.jpg)', images))).toEqual(['/same.jpg', '/same.jpg'])
  })

  test('does not turn image-looking code into a document image', () => {
    expect(imageSources(render('`![示例](/photo.jpg)`', [{ url: '/photo.jpg', alt: '附图' }]))).toEqual(['/photo.jpg'])
  })
})
