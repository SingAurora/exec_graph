import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ToastContext } from '../../shared/ui/toast/ToastContext.ts'
import { AgreementWorkspace } from './AgreementWorkspace.tsx'

const node = {
  uuid: 'node-1', id: 'node-1', graphUuid: 'graph-1', number: 1, authorUuid: 'user-1', version: 2,
  title: '本次实际行动', markdown: '行动事实', agreementMarkdown: '引用时记录观察结果',
  conversation: [{ id: 'action-user', speaker: 'user', body: '行动对话不能混入约定对话' }],
  agreementConversation: [{ id: 'agreement-user', speaker: 'user', body: '约定对话历史应恢复' }],
}

function render() {
  return renderToStaticMarkup(createElement(ToastContext.Provider, { value: { showToast() {} } },
    createElement(AgreementWorkspace, { node, actions: [node], profileName: '乔', profileUuid: 'user-1', onBack() {}, onConfirm() { return true } })))
}

describe('agreement workspace', () => {
  test('restores only the agreement conversation without an action view', () => {
    const html = render()
    expect(html).toContain('>拟定约定</h2>')
    expect(html).toContain('>约定</span>')
    expect(html).toContain('约定对话历史应恢复')
    expect(html).not.toContain('行动对话不能混入约定对话')
    expect(html).not.toContain('行动事实')
    expect(html).toContain('引用时记录观察结果')
    expect(html).not.toContain('保存约定')
    expect(html).not.toContain('发布约定')
    expect(html).toContain('默认效果')
    expect(html).toContain('给我一个默认效果的约定')
  })
})
