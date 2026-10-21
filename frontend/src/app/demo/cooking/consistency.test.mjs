import { describe, expect, test } from 'bun:test'
import { cookingActions } from './index.ts'
import { getActionContextIds, getActionParentIds, getPreferredPath } from '../../../entities/action/lib/graph.ts'
import { getActionSourceAgreements, getUnreviewedAgreementCount } from '../../../entities/action/lib/references.ts'
import { getActionAgreement, getActionAgreementOrigin } from '../../../entities/action/lib/agreements.ts'

const byId = new Map(cookingActions.map((node) => [node.id, node]))

describe('cooking demo provenance', () => {
  test('demonstrates inherited, revised and explicitly cleared agreements without changing incoming obligations', () => {
    expect(getActionAgreement(cookingActions, 'cooking-8').sourceNode.number).toBe(5)
    expect(getActionAgreementOrigin(cookingActions, 'cooking-9')).toEqual({ kind: 'modified', node: byId.get('cooking-5') })
    expect(getActionAgreement(cookingActions, 'cooking-12').markdown).toBe('')
    expect(getActionSourceAgreements(cookingActions, 'cooking-12')[0].agreementStatus).toBe('satisfied')
    expect(byId.get('cooking-12').conversation.some((message) => message.body.includes('清空本节点向后传递的约定'))).toBe(true)
    expect(byId.get('cooking-8').conversation.some((message) => message.body.includes('约定沿用承接节点的有效版本'))).toBe(true)
  })
  test('demonstrates independent compliance assessments without an approval workflow', () => {
    const joAgreements = getActionSourceAgreements(cookingActions, 'cooking-13')
    expect(joAgreements.map((reference) => [reference.source.number, reference.agreementStatus])).toEqual([
      [10, 'exception'], [4, 'satisfied'],
    ])
    const miaoAgreements = getActionSourceAgreements(cookingActions, 'cooking-14')
    expect(miaoAgreements.map((reference) => [reference.source.number, reference.agreementStatus])).toEqual([[11, 'satisfied'], [7, 'unreviewed']])
    expect(getUnreviewedAgreementCount(miaoAgreements)).toBe(1)
    expect(getActionSourceAgreements(cookingActions, 'cooking-5')[0].agreementStatus).toBe('exception')
    expect(getActionSourceAgreements(cookingActions, 'cooking-15')[0].agreementStatus).toBe('exception')
    expect(getUnreviewedAgreementCount(getActionSourceAgreements(cookingActions, 'cooking-15'))).toBe(0)
    expect(getActionSourceAgreements(cookingActions, 'cooking-18')[0].agreementStatus).toBe('unreviewed')
    expect(getActionSourceAgreements(cookingActions, 'cooking-16')[0].agreementStatus).toBe('satisfied')
    expect(byId.get('cooking-15').conversation.some((message) => message.body.includes('不满足来源约定'))).toBe(true)
    expect(byId.get('cooking-14').conversation.some((message) => message.body.includes('先保留为待核对'))).toBe(true)
  })
  test('conversation choices match empty, inherited, updated and cleared expressions', () => {
    expect(byId.get('cooking-1').conversation.at(-1).body).toContain('表达保持为空')
    expect(byId.get('cooking-8').conversation.at(-1).body).toContain('表达沿用承接节点，没有重新生成')
    expect(byId.get('cooking-12').conversation.at(-2).body).toContain('主动清空表达')
    expect(byId.get('cooking-12').conversation.at(-1).body).toContain('清空本节点的表达')
    expect(byId.get('cooking-14').conversation.at(-1).body).toContain('按你的选择写入表达')
  })
  test('only references earlier published actions and captures the complete cited background', () => {
    for (const node of cookingActions) {
      const sources = getActionParentIds(node)
      for (const sourceId of sources) {
        const source = byId.get(sourceId)
        expect(source, `${node.id} has a missing source`).toBeDefined()
        expect(Date.parse(source.createdAt)).toBeLessThan(Date.parse(node.createdAt))
      }
      expect(node.contextSnapshot.directNodeIds).toEqual(sources)
      expect(node.contextSnapshot.historyNodeCount).toBe(getActionContextIds(cookingActions, node.id).size - 1)
      for (const assessment of node.referenceAgreements ?? []) {
        expect(sources).toContain(assessment.sourceId)
        const source = byId.get(assessment.sourceId)
        expect(getActionAgreement(cookingActions, source.id).markdown.trim()).toBeTruthy()
        expect(assessment).not.toHaveProperty('approvedById')
      }
    }
  })

  test('documents and conversations do not borrow facts from uncited project branches', () => {
    for (const node of cookingActions) {
      const context = getActionContextIds(cookingActions, node.id)
      const texts = [node.objectiveMarkdown, node.expressionMarkdown, ...node.conversation.map((message) => message.body)]
      for (const text of texts) {
        if (text === undefined) continue
        for (const match of text.matchAll(/#(\d+)/g)) {
          expect(context.has(`cooking-${match[1]}`), `${node.id} mentions uncited #${match[1]}`).toBe(true)
        }
      }
    }
  })

  test('latest peer routes remain independently readable without treating publication order as context', () => {
    const main = getPreferredPath(cookingActions)
    expect(main.at(-1).id).toBe('cooking-13')
    const joContext = getActionContextIds(cookingActions, 'cooking-13')
    const miaoContext = getActionContextIds(cookingActions, 'cooking-14')
    expect(joContext.has('cooking-11')).toBe(false)
    expect(joContext.has('cooking-12')).toBe(false)
    expect(miaoContext.has('cooking-10')).toBe(false)
    expect(miaoContext.has('cooking-13')).toBe(false)
  })
})
