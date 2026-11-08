import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProfileSearchForm } from './ProfileSearchForm.tsx'

const render = (scope, criteria) => renderToStaticMarkup(createElement(ProfileSearchForm, {
  scope, criteria, counterpartOptions: [{ value: 'miao', label: 'miao' }], onChange() {}, onSubmit() {}, onReset() {},
}))

describe('independent profile search form', () => {
  test('only agreement search exposes a counterpart and permits counterpart-only submissions', () => {
    const html = render('agreements', { keyword: '', counterpartUuid: 'miao' })
    expect(html).toContain('title="往来对象"')
    expect(html).toContain('>miao</span>')
    expect(html).not.toContain('type="submit" disabled')
    for (const scope of ['expressions', 'actions', 'graphs']) {
      const other = render(scope, { keyword: '', counterpartUuid: 'miao' })
      expect(other).not.toContain('往来对象')
      expect(other).toContain('type="submit" disabled')
    }
  })

  test('blank or whitespace queries cannot submit, while keywords can', () => {
    expect(render('expressions', { keyword: '   ', counterpartUuid: '' })).toContain('type="submit" disabled')
    expect(render('expressions', { keyword: '火候', counterpartUuid: '' })).not.toContain('type="submit" disabled')
  })
})
