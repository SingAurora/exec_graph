import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DraftImages } from './DraftImages.tsx'

const noop = () => {}

describe('action image attachments', () => {
  test('requires a 30-character note and shows the attachment count', () => {
    const html = renderToStaticMarkup(createElement(DraftImages, {
      images: [{ assetUuid: '11111111-1111-4111-8111-111111111111', url: '/image.jpg', alt: '' }],
      ready: true, disabled: false, onChange: noop, onBusyChange: noop,
    }))
    expect(html).toMatch(/maxlength="30"/i)
    expect(html).toContain('图片备注（必填')
    expect(html).toContain('1/12')
    expect(html).toContain('data-invalid="true"')
    expect(html).toContain('title="查看图片 1 大图"')
    expect(html).toContain('0/30')
  })
})
