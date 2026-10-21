import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProfileBiography } from './ProfileBiography.tsx'

const render = (biography, compact = false) => renderToStaticMarkup(createElement(ProfileBiography, { biography, compact }))

describe('Markdown biographies', () => {
  test('renders emoji, emphasis and pictures while keeping text links inert', () => {
    const html = render('🍅 **认真做饭** [一起做饭](#project?projectId=cooking)\n\n第二段经历。\n\n![晚饭](/dinner.jpg)')
    expect(html).toContain('🍅 <strong>认真做饭</strong>')
    expect(html).toContain('一起做饭')
    expect(html).not.toContain('<a ')
    expect(html).toContain('第二段经历。')
    expect(html).toContain('src="/dinner.jpg"')
    expect(html).toContain('查看图片：晚饭')
  })

  test('compact biographies keep the first text block and one image, including reference-style content', () => {
    const html = render('![封面][cover]\n\n🍅 **乔** [一起做饭][graph] ![配图](/extra.jpg)\n\n第二段不进卡片。\n\n[cover]: /cover.jpg\n[graph]: #project?projectId=cooking', true)
    expect(html).toContain('<strong>乔</strong>')
    expect(html).toContain('一起做饭')
    expect(html).not.toContain('<a ')
    expect(html.match(/<img\b/g)).toHaveLength(1)
    expect(html).toContain('src="/cover.jpg"')
    expect(html).not.toContain('/extra.jpg')
    expect(html).not.toContain('第二段不进卡片')
  })

  test('image-only, plain-text and unset biographies remain valid', () => {
    const imageOnly = render('![封面][cover]\n\n[cover]: /cover.jpg', true)
    expect(imageOnly).toContain('src="/cover.jpg"')
    expect(imageOnly).not.toContain('[cover]')
    expect(render('普通简介', true)).toContain('普通简介')
    expect(render('   ')).toBe('')
  })

  test('neither full nor compact biographies linkify URLs, emails, references or linked images', () => {
    const biography = '[站内](#my) [网页](https://example.com) [邮箱](mailto:hello@example.com) <https://example.com/path> https://example.com/bare www.example.com hello@example.com [引用][page] [![配图](/photo.jpg)](https://example.com/image-target)\n\n[page]: /elsewhere'
    for (const compact of [false, true]) {
      const html = render(biography, compact)
      expect(html).not.toContain('<a ')
      expect(html).not.toContain('href=')
      expect(html).toContain('站内')
      expect(html).toContain('hello@example.com')
      expect(html).toContain('src="/photo.jpg"')
      expect(html).toContain('查看图片：配图')
    }
  })
})
