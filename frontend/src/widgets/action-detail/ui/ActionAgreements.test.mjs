import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { getActionReferences, getActionSourceAgreements, getUnreviewedAgreementCount } from '../../../entities/action/lib/references.ts'
import { ActionOwnAgreement, ActionSourceAgreements } from './ActionAgreements.tsx'
import { ActionReferenceDetail } from '../../action-reference/ui/ActionReferenceDetail.tsx'
import { ArchiveBackground } from '../../action-archive/ui/ArchiveBackground.tsx'

const node = (id, extra = {}) => ({ id, projectId: 'graph', authorId: 'jo', number: Number(id), title: `行动 ${id}`, markdown: '行动内容', images: [], conversation: [], createdAt: '2026-10-18T12:00:00+08:00', ...extra })
const users = [{ id: 'lin', name: '林岚', avatar: '' }, { id: 'jo', name: '乔', avatar: '' }]
function render(actions, id) {
  return renderToStaticMarkup(createElement(ActionSourceAgreements, { node: actions.find((item) => item.id === id), actions, users, onSelect() {} }))
}

describe('node agreement overview', () => {
  test('reference details and formation history both read the source effective version', () => {
    const actions = [node('1', { agreementMarkdown: '必须记录完整用时' }), node('2', { parentId: '1' }),
      node('3', { parentId: '2', agreementMarkdown: '', referenceAgreements: [{ sourceId: '2', complies: true }] })]
    const reference = getActionReferences(actions).find((item) => item.target.id === '3')
    const line = renderToStaticMarkup(createElement(ActionReferenceDetail, { reference, actions, users, onSelectNode() {}, onHide() {} }))
    const archive = renderToStaticMarkup(createElement(ArchiveBackground, { node: actions[2], actions, onSelectSource() {} }))
    for (const html of [line, archive]) {
      expect(html).toContain('必须记录完整用时')
      expect(html).toContain('继承自')
      expect(html).toContain('查看约定版本节点 #1')
      expect(html).toContain('满足来源约定')
    }
  })
  test('lists each direct source effective agreement, including inherited versions, without adding ancestor entries', () => {
    const actions = [node('1', { agreementMarkdown: '祖先约定' }), node('2', { parentId: '1' }), node('3', { agreementMarkdown: '直接约定' }), node('4', { projectId: 'other', agreementMarkdown: '其他图约定' }),
      node('5', { parentId: '2', mergedParentIds: ['3', '3', '4'] })]
    expect(getActionSourceAgreements(actions, '5').map((reference) => reference.source.id)).toEqual(['2', '3'])
    expect(getActionSourceAgreements(actions, '2').map((reference) => reference.source.id)).toEqual(['1'])
    const html = render(actions, '5')
    expect(html).toContain('查看约定来源节点 #3')
    expect(html).toContain('祖先约定')
    expect(html).toContain('查看约定版本节点 #1')
    expect(html).not.toContain('查看约定来源节点 #1')
    expect(html).not.toContain('其他图约定')
    expect(render(actions, '1')).toBe('')
  })

  test('separates compliance, unknown and noncompliance without approval for either author relationship', () => {
    const sources = [node('1'), node('2'), node('3'), node('4', { authorId: 'lin' }), node('5', { authorId: 'lin' })].map((source) => ({ ...source, agreementMarkdown: `约定 ${source.id}` }))
    const target = node('6', { parentId: '1', mergedParentIds: ['2', '3', '4', '5'], referenceAgreements: [
      { sourceId: '1', complies: true },
      { sourceId: '3', complies: false, exceptionReason: '本人换锅' },
      { sourceId: '4', complies: false, exceptionReason: '只尝热时' },
      { sourceId: '5', complies: false, exceptionReason: '未做静置' },
    ] })
    const actions = [...sources, target]
    const references = getActionSourceAgreements(actions, '6')
    expect(references).toHaveLength(5)
    expect(getUnreviewedAgreementCount(references)).toBe(1)
    expect(references.filter((reference) => reference.agreementStatus === 'exception')).toHaveLength(3)
    const html = render(actions, '6')
    for (const text of ['待核对 1', '满足约定', '尚未核对', '本人换锅', '只尝热时', '未做静置']) expect(html).toContain(text)
    expect(html).not.toMatch(/授权|申请|同意|待处理/)
    expect(html.match(/× 不满足约定/g)).toHaveLength(3)
    expect(html).not.toMatch(/<details[^>]*\sopen[\s=>]/)
  })

  test('noncompliance needs no further approval and does not count as unreviewed', () => {
    const source = node('1', { agreementMarkdown: '十分钟静置观察' })
    const target = node('2', { parentId: '1', referenceAgreements: [{ sourceId: '1', complies: false, exceptionReason: '只放五分钟' }] })
    const references = getActionSourceAgreements([source, target], '2')
    expect(getUnreviewedAgreementCount(references)).toBe(0)
    expect(references[0].agreementStatus).toBe('exception')
    expect(render([source, target], '2')).not.toContain('· 待核对')
    const reference = references[0]
    const detail = renderToStaticMarkup(createElement(ActionReferenceDetail, { reference, actions: [source, target], users, onSelectNode() {}, onHide() {} }))
    expect(detail).toContain('不符合原因')
    expect(detail).toContain('只放五分钟')
    expect(detail).not.toMatch(/授权|申请|同意/)
  })

  test('the downstream agreement is independent, inherits with provenance and explicitly shows empty states', () => {
    const action = node('1', { agreementMarkdown: '**后续引用**需要说明实际吃法' })
    const renderOwn = (actions, action) => renderToStaticMarkup(createElement(ActionOwnAgreement, { node: action, actions, onSelect() {} }))
    const html = renderOwn([action], action)
    expect(html).toContain('本节点约定')
    expect(html).toContain('<strong>后续引用</strong>')
    expect(render([action], '1')).toBe('')
    const child = node('2', { parentId: '1' })
    expect(renderOwn([action, child], child)).toContain('继承自')
    const cleared = { ...child, agreementMarkdown: '' }
    expect(renderOwn([action, cleared], cleared)).toContain('无约定')
    expect(renderOwn([action, cleared], cleared)).not.toContain('<strong>后续引用</strong>')
    expect(renderOwn([node('3')], node('3'))).toContain('无约定')
  })
})
