import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Popover } from 'radix-ui'
import { ProfilePreview, ProfilePreviewCard } from './ProfilePreview.tsx'

const profile = { uuid: 'user /乔', id: 'user /乔', name: '乔', avatar: '', gender: 'unknown', email: 'private@example.com', bio: '**认真吃饭**\n\n[外部链接](https://example.com)' }
const renderCard = (props = {}) => renderToStaticMarkup(createElement(Popover.Root, null,
  createElement(ProfilePreviewCard, { profile, userUuid: profile.uuid, ...props }),
))

describe('public profile preview', () => {
  test('the identity opens a popover without navigating directly or rendering private account data', () => {
    const html = renderToStaticMarkup(createElement(ProfilePreview, { profile, userUuid: profile.uuid }, profile.name))
    expect(html).toContain('title="查看乔的资料"')
    expect(html).toContain('data-state="closed"')
    expect(html).not.toContain('href=')
    expect(html).not.toContain(profile.email)
  })

  test('only the preview avatar and name navigate to the encoded profile route', () => {
    const html = renderCard()
    expect(html.match(/<a /g)).toHaveLength(2)
    expect(html.split(`href="#profile?userUuid=${encodeURIComponent(profile.uuid)}"`)).toHaveLength(3)
    expect(html).toContain('认真吃饭')
    expect(html).not.toContain('href="https://example.com"')
    expect(html).not.toContain(profile.email)
  })

  test('preserves graph return context in both profile links', () => {
    const href = '#profile?userUuid=jo&fromGraph=cooking&fromTab=explore'
    expect(renderCard({ href }).split('href="' + href.replaceAll('&', '&amp;') + '"')).toHaveLength(3)
  })

  test('missing profiles retain a usable identity and profile destination', () => {
    const html = renderCard({ profile: undefined, userUuid: 'unknown-user' })
    expect(html).toContain('查看unknown-user的主页')
    expect(html).toContain('href="#profile?userUuid=unknown-user"')
  })

  test('shows the default biography prompt when the profile biography is empty', () => {
    expect(renderCard({ profile: { ...profile, bio: ' ' } })).toContain('该用户没有更多想表达的事情。')
  })
})
