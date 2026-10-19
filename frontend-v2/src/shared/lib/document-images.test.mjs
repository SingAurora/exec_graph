import { describe, expect, test } from 'bun:test'
import { getMarkdownImages } from './document-images.ts'

describe('Markdown preview image extraction', () => {
  test('keeps document order, nested parentheses, references and intentional repeats', () => {
    expect(getMarkdownImages(`![第一张](/photo(1).jpg "标题")

![第二张][Photo]

![重复](/photo(1).jpg)

[photo]: /reference.jpg`)).toEqual([
      { url: '/photo(1).jpg', alt: '第一张' },
      { url: '/reference.jpg', alt: '第二张' },
      { url: '/photo(1).jpg', alt: '重复' },
    ])
  })

  test('ignores image-looking code, ordinary links, escaped syntax and unresolved references', () => {
    const markdown = '`![代码](/code.jpg)`\n\n```md\n![示例](/example.jpg)\n```\n\n[链接](/link.jpg)\n\n\\![转义](/escaped.jpg)\n\n![缺失][missing]'
    expect(getMarkdownImages(markdown)).toEqual([])
  })

  test('handles image-only and empty documents and follows the reader URL transformation', () => {
    expect(getMarkdownImages('![](/photo.jpg)')).toEqual([{ url: '/photo.jpg', alt: '文档图片' }])
    expect(getMarkdownImages('没有附图')).toEqual([])
    expect(getMarkdownImages('')).toEqual([])
    expect(getMarkdownImages('![无效](javascript:alert)')).toEqual([])
  })
})
