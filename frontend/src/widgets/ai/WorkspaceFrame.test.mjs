import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { WorkspaceFrame } from './WorkspaceFrame.tsx'

const noop = () => {}
const render = (action) => renderToStaticMarkup(createElement(WorkspaceFrame, {
  title: '记录第一次行动', help: null, messages: [], profileName: '乔',
  input: '', placeholder: '说说这次实际做了什么', sending: false,
  onInputChange: noop, onSend: noop, onBack: noop,
  action, expression: { markdown: '', empty: '暂无表达' }, agreement: null, footer: null,
}))

describe('workspace document preview', () => {
  test('shows the generated action title above its Markdown', () => {
    const html = render({ title: '解放波士顿', markdown: '先攻下小城。', empty: '在 AI 对话中描述这次行动' })
    expect(html).toContain('解放波士顿')
    expect(html.indexOf('解放波士顿')).toBeLessThan(html.indexOf('先攻下小城'))
  })

  test('does not repeat a title already used as the first Markdown heading', () => {
    const html = render({ title: '解放波士顿', markdown: '# 解放波士顿\n\n先攻下小城。', empty: '' })
    expect(html.match(/解放波士顿/g)).toHaveLength(1)
  })
})
