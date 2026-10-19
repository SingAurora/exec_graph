import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ActionPostList } from './ActionPostList.tsx'

const noop = () => {}
const render = (props) => renderToStaticMarkup(createElement(ActionPostList, {
  nodes: [], actions: [], users: [], onExplore: noop, ...props,
}))

describe('empty graph lists', () => {
  test('the action list stays empty without duplicating the header creation entry', () => {
    const html = render({ mode: 'objective' })
    expect(html).toContain('暂无行动')
    expect(html).not.toContain('<button')
  })

  test('the expression list remains empty without an action creation prompt', () => {
    const html = render({ mode: 'expression' })
    expect(html).toContain('暂无表达')
    expect(html).not.toContain('<button')
  })
})
