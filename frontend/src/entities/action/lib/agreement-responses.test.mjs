import { describe, expect, test } from 'bun:test'
import { getActionReferences } from './references.ts'
import { filterAgreementParticipants, getProfileAgreementResponses, getReferenceAgreementAuthorId, getSatisfiedAgreementResponses } from './agreement-responses.ts'

const node = (number, extra = {}) => ({
  id: String(number), number, projectId: 'graph', authorId: 'jo', title: `行动 ${number}`,
  createdAt: `2026-10-${String(number).padStart(2, '0')}T19:00:00+08:00`, ...extra,
})
const satisfied = (sourceId) => ({ sourceId: String(sourceId), complies: true })
const responses = (nodes) => getSatisfiedAgreementResponses(getActionReferences(nodes))

describe('interpersonal agreement responses', () => {
  test('requires a real nonempty source agreement and an explicit satisfied assessment', () => {
    const nodes = [node(1, { agreementMarkdown: '记录锅具和实际用时' }),
      node(2, { parentId: '1', authorId: 'lin', referenceAgreements: [satisfied(1)] }),
      node(3, { parentId: '1', authorId: 'miao' }),
      node(4, { parentId: '1', authorId: 'lin', referenceAgreements: [{ sourceId: '1', complies: false }] }),
      node(5, { parentId: '1', referenceAgreements: [satisfied(1)] }),
      node(6), node(7, { parentId: '6', authorId: 'lin', referenceAgreements: [satisfied(6)] }),
      node(8, { parentId: 'missing', authorId: 'lin', referenceAgreements: [satisfied('missing')] })]
    expect(responses(nodes).map((item) => item.id)).toEqual(['1:2'])
  })

  test('attributes inherited agreements to their origin and omits responses to oneself', () => {
    const nodes = [node(1, { agreementMarkdown: '保留失败的结果' }), node(2, { parentId: '1', authorId: 'lin' }),
      node(3, { parentId: '2', authorId: 'miao', referenceAgreements: [satisfied(2)] }),
      node(4, { parentId: '2', authorId: 'jo', referenceAgreements: [satisfied(2)] })]
    const [response] = responses(nodes)
    expect(response.id).toBe('2:3')
    expect(getReferenceAgreementAuthorId(response)).toBe('jo')
    expect(response.agreement.sourceNode.id).toBe('1')
    expect(responses(nodes)).toHaveLength(1)
  })

  test('uses modified source versions even when the responder clears downstream agreements', () => {
    const nodes = [node(1, { agreementMarkdown: '旧约定' }),
      node(2, { parentId: '1', authorId: 'lin', agreementMarkdown: '记录盛蛋状态' }),
      node(3, { parentId: '2', authorId: 'miao', agreementMarkdown: '', referenceAgreements: [satisfied(2)] }),
      node(4, { parentId: '3', authorId: 'jo', referenceAgreements: [satisfied(3)] })]
    const [response] = responses(nodes)
    expect(responses(nodes)).toHaveLength(1)
    expect(getReferenceAgreementAuthorId(response)).toBe('lin')
    expect(response.agreement.markdown).toBe('记录盛蛋状态')
  })

  test('preserves separate merge arrows and repeated responses, newest first without mutating input', () => {
    const nodes = [node(1, { agreementMarkdown: '记录用时' }), node(2, { authorId: 'lin', agreementMarkdown: '记录锅具' }),
      node(3, { authorId: 'miao', parentId: '1', referenceAgreements: [satisfied(1)] }),
      node(4, { authorId: 'miao', parentId: '1', mergedParentIds: ['2'], referenceAgreements: [satisfied(1), satisfied(2)] })]
    const references = getActionReferences(nodes)
    const ids = references.map((item) => item.id)
    expect(getSatisfiedAgreementResponses(references).map((item) => item.id)).toEqual(['1:4', '2:4', '1:3'])
    expect(references.map((item) => item.id)).toEqual(ids)
  })

  test('profiles include both exchange directions, attributing inherited agreements to their actual author', () => {
    const nodes = [node(1, { agreementMarkdown: '保留实际结果' }),
      node(2, { parentId: '1', authorId: 'lin' }),
      node(3, { parentId: '2', authorId: 'miao', referenceAgreements: [satisfied(2)] }),
      node(4, { authorId: 'miao', agreementMarkdown: '记录锅具' }),
      node(5, { parentId: '4', referenceAgreements: [satisfied(4)] }),
      node(6, { parentId: '1', authorId: 'che', referenceAgreements: [{ sourceId: '1', complies: false }] }),
      node(7, { parentId: '4', authorId: 'lin' })]
    const references = getActionReferences(nodes)
    expect(getProfileAgreementResponses(references, 'jo').map((item) => item.id)).toEqual(['4:5', '2:3'])
    expect(getProfileAgreementResponses(references, 'miao').map((item) => item.id)).toEqual(['4:5', '2:3'])
    expect(getProfileAgreementResponses(references, 'lin')).toEqual([])
    expect(getProfileAgreementResponses(references, 'che')).toEqual([])
    expect(getProfileAgreementResponses(references, 'unknown')).toEqual([])
  })

  test('counterpart selection keeps both directions across graphs without including an inheriting intermediary', () => {
    const nodes = [node(1, { agreementMarkdown: '保留实际结果' }),
      node(2, { parentId: '1', authorId: 'lin' }),
      node(3, { parentId: '2', authorId: 'miao', referenceAgreements: [satisfied(2)] }),
      node(4, { projectId: 'other', authorId: 'miao', agreementMarkdown: '记录锅具' }),
      node(5, { projectId: 'other', parentId: '4', referenceAgreements: [satisfied(4)] }),
      node(6, { parentId: '1', authorId: 'third', referenceAgreements: [satisfied(1)] })]
    const profile = getProfileAgreementResponses(getActionReferences(nodes), 'jo')
    const filtered = filterAgreementParticipants(profile, 'jo', 'miao')
    expect(filtered.map((item) => item.id)).toEqual(['4:5', '2:3'])
    expect(filterAgreementParticipants(profile, 'miao', 'jo')).toEqual(filtered)
    expect(filterAgreementParticipants(profile, 'miao')).toEqual(filtered)
    expect(filterAgreementParticipants(profile, undefined, 'miao')).toEqual(filtered)
    expect(filterAgreementParticipants(profile, 'jo', 'lin')).toEqual([])
    expect(filterAgreementParticipants(profile, 'jo', 'jo')).toEqual([])
    expect(filterAgreementParticipants(profile, 'unknown')).toEqual([])
    expect(filterAgreementParticipants(profile)).toBe(profile)
    expect(profile.map((item) => item.id)).toEqual(['1:6', '4:5', '2:3'])
    expect(filtered[0]).toBe(profile[1])
  })

  test('participant matching uses the actual editor of a modified agreement', () => {
    const nodes = [node(1, { agreementMarkdown: '新约定', agreementSupplement: { authorId: 'editor', createdAt: '2026-10-01T20:00:00+08:00', kind: 'modify' } }),
      node(2, { parentId: '1', authorId: 'lin', referenceAgreements: [satisfied(1)] })]
    const items = responses(nodes)
    expect(filterAgreementParticipants(items, 'editor', 'lin')).toEqual(items)
    expect(filterAgreementParticipants(items, 'jo', 'lin')).toEqual([])
  })
})
