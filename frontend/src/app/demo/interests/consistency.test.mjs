import { describe, expect, test } from 'bun:test'
import { currentUser, initialProjects } from '../catalog.ts'
import { demoActions } from '../actions.ts'
import { interestActions, interestHighlightNodeIds, interestProjects } from './index.ts'
import { getProfileHighlightCandidates } from '../../../entities/action/lib/profile-highlights.ts'
import { getActionAgreement } from '../../../entities/action/lib/agreements.ts'
import { getActionContextIds } from '../../../entities/action/lib/graph.ts'
import { getActionSourceAgreements } from '../../../entities/action/lib/references.ts'

describe('five-interest profile demo', () => {
  test('defaults to five eligible personal expressions in the requested order', () => {
    const ids = ['weight-3', 'cycling-3', 'photography-3', 'board-games-3', 'gaming-3']
    expect(currentUser.highlights.expressionNodeIds).toEqual(ids)
    expect(interestHighlightNodeIds).toEqual(ids)
    const candidates = getProfileHighlightCandidates(demoActions, currentUser.id)
    for (const id of ids) {
      const entry = candidates.find((candidate) => candidate.node.id === id)
      expect(entry).toBeDefined()
      expect(entry.node.authorId).toBe(currentUser.id)
      expect(entry.markdown.trim()).toBeTruthy()
      expect(entry.agreement.markdown.trim()).toBeTruthy()
      expect(entry.agreement.sourceNode.id).toBe(id.replace(/3$/, '2'))
      expect(entry.node.images).toHaveLength(1)
    }
  })

  test('every highlight opens a complete graph with earlier, satisfied cross-user references', () => {
    for (const graph of interestProjects) {
      expect(initialProjects).toContainEqual(graph)
      const nodes = interestActions.filter((node) => node.projectId === graph.id)
      expect(nodes).toHaveLength(3)
      expect(nodes.map((node) => node.number)).toEqual([1, 2, 3])
      expect(graph.participantIds).toContain(nodes[1].authorId)
      expect(graph.ownerId).toBe(currentUser.id)
      for (const node of nodes) {
        expect(demoActions).toContainEqual(node)
        expect(getActionContextIds(demoActions, node.id).size - 1).toBe(node.contextSnapshot.historyNodeCount)
        expect(node.contextSnapshot.directNodeIds).toEqual(node.parentId ? [node.parentId] : [])
        if (!node.parentId) continue
        const parent = nodes.find((source) => source.id === node.parentId)
        expect(parent).toBeDefined()
        expect(parent.authorId).not.toBe(node.authorId)
        expect(Date.parse(parent.createdAt)).toBeLessThan(Date.parse(node.createdAt))
        expect(getActionAgreement(demoActions, parent.id).markdown.trim()).toBeTruthy()
        expect(getActionSourceAgreements(demoActions, node.id).map((source) => source.agreementStatus)).toEqual(['satisfied'])
      }
    }
  })
})
