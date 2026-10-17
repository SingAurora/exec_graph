import { describe, expect, test } from 'bun:test'
import { cookingActions } from './index.ts'
import { getActionContextIds, getActionParentIds, getPreferredPath } from '../../../entities/action/lib/graph.ts'

const byId = new Map(cookingActions.map((node) => [node.id, node]))

describe('cooking demo provenance', () => {
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
        expect(source.agreementMarkdown?.trim()).toBeTruthy()
        if (assessment.approvedById) expect(assessment.approvedById).toBe(source.authorId)
      }
    }
  })

  test('documents and conversations do not borrow facts from uncited project branches', () => {
    for (const node of cookingActions) {
      const context = getActionContextIds(cookingActions, node.id)
      const texts = [node.objectiveMarkdown, node.expressionMarkdown, ...node.conversation.map((message) => message.body)]
      for (const text of texts) {
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
