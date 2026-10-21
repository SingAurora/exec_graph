import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SourceAgreementReviews } from './SourceAgreementReviews.tsx'

const source = (number, kind, markdown, origin = number) => ({
  node: { id: String(number), number, title: `行动 ${number}` }, kind,
  agreement: { markdown, sourceNode: { id: String(origin), number: origin } },
})

describe('per-source agreement review presentation', () => {
  test('shows primary and merged results separately, including missing assessments and empty agreements', () => {
    const html = renderToStaticMarkup(createElement(SourceAgreementReviews, {
      sources: [source(2, 'primary', '记录锅温'), source(4, 'merged', '静置十分钟', 3), source(5, 'merged', ''), source(7, 'merged', '记录用时')],
      reviews: [{ nodeNumber: 2, complies: true, reason: '锅温已记录' }, { nodeNumber: 4, complies: false, reason: '只静置了五分钟' }],
    }))
    expect(html).toContain('承接 #2')
    expect(html).toContain('合入 #4')
    expect(html).toContain('约定继承自 节点 #3')
    expect(html).toContain('核对说明：锅温已记录')
    expect(html).toContain('× 不满足约定')
    expect(html).toContain('不符合原因：只静置了五分钟')
    expect(html).toContain('合入 #5')
    expect(html).toContain('无约定')
    expect(html).toContain('合入 #7')
    expect(html).toContain('尚未核对')
    expect(html).not.toContain('等待同意')
  })
})
