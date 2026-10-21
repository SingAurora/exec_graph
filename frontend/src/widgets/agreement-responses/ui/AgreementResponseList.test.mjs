import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { getActionReferences } from '../../../entities/action/lib/references.ts'
import { AgreementResponseList } from './AgreementResponseList.tsx'

const source = {
  id: 'source', projectId: 'graph', number: 1, authorId: 'jo', title: '来源行动',
  agreementMarkdown: '请记录食材状态。\n\n![约定配图](/agreement.jpg)',
  images: [{ url: '/source-action.jpg', alt: '来源行动附图' }], createdAt: '2026-10-01T12:00:00+08:00',
}
const inherited = { ...source, id: 'inherited', number: 2, authorId: 'lin', parentId: 'source', agreementMarkdown: undefined }
const response = {
  ...source, id: 'response', number: 3, authorId: 'miao', parentId: 'inherited',
  agreementMarkdown: '后续约定\n\n![后续附图](/downstream.jpg)',
  images: [{ url: '/response-action.jpg', alt: '本次行动附图' }],
  referenceAgreements: [{ sourceId: 'inherited', complies: true }],
}
const render = (nodes) => renderToStaticMarkup(createElement(AgreementResponseList, {
  references: getActionReferences(nodes), users: [], active: true, onExplore() {},
}))

describe('agreement preview provenance', () => {
  test('uses the satisfied inherited agreement images, never action attachments or downstream images', () => {
    const html = render([source, inherited, response])
    expect(html).toContain('src="/agreement.jpg"')
    expect(html).not.toContain('src="/source-action.jpg"')
    expect(html).not.toContain('src="/response-action.jpg"')
    expect(html).not.toContain('src="/downstream.jpg"')
  })

  test('does not use action attachments when the source agreement has no embedded images', () => {
    const html = render([{ ...source, agreementMarkdown: '记录实际用时' }, inherited, response])
    expect(html).not.toContain('<img ')
    expect(html).not.toContain('查看图片：')
  })
})
