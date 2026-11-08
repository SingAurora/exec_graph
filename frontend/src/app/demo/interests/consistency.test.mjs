import { describe, expect, test } from 'bun:test'
import { currentUser, initialGraphs } from '../catalog.ts'
import { demoActions } from '../actions.ts'
import { interestActions, interestHighlightNodeUuids, interestGraphs } from './index.ts'
import { getProfileHighlightCandidates } from '../../../entities/action/lib/profile-highlights.ts'
import { getActionAgreement } from '../../../entities/action/lib/agreements.ts'
import { getActionContextIds } from '../../../entities/action/lib/graph.ts'
import { getActionSourceAgreements } from '../../../entities/action/lib/references.ts'

describe('five-interest profile demo', () => {
  test('defaults to five eligible personal expressions in the requested order', () => {
    const ids = ['weight-3', 'cycling-3', 'photography-3', 'board-games-3', 'gaming-3']
    expect(currentUser.highlights.expressionNodeUuids).toEqual(ids)
    expect(interestHighlightNodeUuids).toEqual(ids)
    const candidates = getProfileHighlightCandidates(demoActions, currentUser.uuid)
    for (const id of ids) {
      const entry = candidates.find((candidate) => candidate.node.uuid === id)
      expect(entry).toBeDefined()
      expect(entry.node.authorUuid).toBe(currentUser.uuid)
      expect(entry.markdown.trim()).toBeTruthy()
      expect(entry.agreement.markdown.trim()).toBeTruthy()
      expect(entry.agreement.sourceNode.uuid).toBe(id.replace(/3$/, '2'))
      expect(entry.node.images).toHaveLength(1)
    }
  })

  test('every highlight opens a complete graph with earlier, satisfied cross-user references', () => {
    for (const graph of interestGraphs) {
      expect(initialGraphs).toContainEqual(graph)
      const nodes = interestActions.filter((node) => node.graphUuid === graph.uuid)
      expect(nodes).toHaveLength(3)
      expect(nodes.map((node) => node.number)).toEqual([1, 2, 3])
      expect(graph.participantUuids).toContain(nodes[1].authorUuid)
      expect(graph.ownerUuid).toBe(currentUser.uuid)
      for (const node of nodes) {
        expect(demoActions).toContainEqual(node)
        expect(getActionContextIds(demoActions, node.uuid).size - 1).toBe(node.contextSnapshot.historyNodeCount)
        expect(node.contextSnapshot.directNodeUuids).toEqual(node.parentUuid ? [node.parentUuid] : [])
        if (!node.parentUuid) continue
        const parent = nodes.find((source) => source.uuid === node.parentUuid)
        expect(parent).toBeDefined()
        expect(parent.authorUuid).not.toBe(node.authorUuid)
        expect(Date.parse(parent.createdAt)).toBeLessThan(Date.parse(node.createdAt))
        expect(getActionAgreement(demoActions, parent.uuid).markdown.trim()).toBeTruthy()
        expect(getActionSourceAgreements(demoActions, node.uuid).map((source) => source.agreementStatus)).toEqual(['satisfied'])
      }
    }
  })
})
