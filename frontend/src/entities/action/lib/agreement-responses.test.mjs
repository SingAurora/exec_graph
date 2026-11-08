import { describe, expect, test } from 'bun:test'
import { getActionReferences } from './references.ts'
import { filterAgreementParticipants, getProfileAgreementResponses, getReferenceAgreementAuthorUuid, getSatisfiedAgreementResponses } from './agreement-responses.ts'

const node = (number, extra = {}) => ({
  uuid: String(number), id: String(number), number, graphUuid: 'graph', authorUuid: 'jo', title: `行动 ${number}`,
  createdAt: `2026-10-${String(number).padStart(2, '0')}T19:00:00+08:00`, ...extra,
})
const satisfied = (sourceUuid) => ({ sourceUuid: String(sourceUuid), complies: true })
const responses = (nodes) => getSatisfiedAgreementResponses(getActionReferences(nodes))

describe('interpersonal agreement responses', () => {
  test('requires a real nonempty source agreement and an explicit satisfied assessment', () => {
    const nodes = [node(1, { agreementMarkdown: '记录锅具和实际用时' }),
      node(2, { parentUuid: '1', authorUuid: 'lin', referenceAgreements: [satisfied(1)] }),
      node(3, { parentUuid: '1', authorUuid: 'miao' }),
      node(4, { parentUuid: '1', authorUuid: 'lin', referenceAgreements: [{ sourceUuid: '1', complies: false }] }),
      node(5, { parentUuid: '1', referenceAgreements: [satisfied(1)] }),
      node(6), node(7, { parentUuid: '6', authorUuid: 'lin', referenceAgreements: [satisfied(6)] }),
      node(8, { parentUuid: 'missing', authorUuid: 'lin', referenceAgreements: [satisfied('missing')] })]
    expect(responses(nodes).map((item) => item.uuid)).toEqual(['1:2'])
  })

  test('attributes inherited agreements to their origin and omits responses to oneself', () => {
    const nodes = [node(1, { agreementMarkdown: '保留失败的结果' }), node(2, { parentUuid: '1', authorUuid: 'lin' }),
      node(3, { parentUuid: '2', authorUuid: 'miao', referenceAgreements: [satisfied(2)] }),
      node(4, { parentUuid: '2', authorUuid: 'jo', referenceAgreements: [satisfied(2)] })]
    const [response] = responses(nodes)
    expect(response.uuid).toBe('2:3')
    expect(getReferenceAgreementAuthorUuid(response)).toBe('jo')
    expect(response.agreement.sourceNode.uuid).toBe('1')
    expect(responses(nodes)).toHaveLength(1)
  })

  test('uses modified source versions even when the responder clears downstream agreements', () => {
    const nodes = [node(1, { agreementMarkdown: '旧约定' }),
      node(2, { parentUuid: '1', authorUuid: 'lin', agreementMarkdown: '记录盛蛋状态' }),
      node(3, { parentUuid: '2', authorUuid: 'miao', agreementMarkdown: '', referenceAgreements: [satisfied(2)] }),
      node(4, { parentUuid: '3', authorUuid: 'jo', referenceAgreements: [satisfied(3)] })]
    const [response] = responses(nodes)
    expect(responses(nodes)).toHaveLength(1)
    expect(getReferenceAgreementAuthorUuid(response)).toBe('lin')
    expect(response.agreement.markdown).toBe('记录盛蛋状态')
  })

  test('preserves separate merge arrows and repeated responses, newest first without mutating input', () => {
    const nodes = [node(1, { agreementMarkdown: '记录用时' }), node(2, { authorUuid: 'lin', agreementMarkdown: '记录锅具' }),
      node(3, { authorUuid: 'miao', parentUuid: '1', referenceAgreements: [satisfied(1)] }),
      node(4, { authorUuid: 'miao', parentUuid: '1', mergedParentUuids: ['2'], referenceAgreements: [satisfied(1), satisfied(2)] })]
    const references = getActionReferences(nodes)
    const ids = references.map((item) => item.uuid)
    expect(getSatisfiedAgreementResponses(references).map((item) => item.uuid)).toEqual(['1:4', '2:4', '1:3'])
    expect(references.map((item) => item.uuid)).toEqual(ids)
  })

  test('profiles include both exchange directions, attributing inherited agreements to their actual author', () => {
    const nodes = [node(1, { agreementMarkdown: '保留实际结果' }),
      node(2, { parentUuid: '1', authorUuid: 'lin' }),
      node(3, { parentUuid: '2', authorUuid: 'miao', referenceAgreements: [satisfied(2)] }),
      node(4, { authorUuid: 'miao', agreementMarkdown: '记录锅具' }),
      node(5, { parentUuid: '4', referenceAgreements: [satisfied(4)] }),
      node(6, { parentUuid: '1', authorUuid: 'che', referenceAgreements: [{ sourceUuid: '1', complies: false }] }),
      node(7, { parentUuid: '4', authorUuid: 'lin' })]
    const references = getActionReferences(nodes)
    expect(getProfileAgreementResponses(references, 'jo').map((item) => item.uuid)).toEqual(['4:5', '2:3'])
    expect(getProfileAgreementResponses(references, 'miao').map((item) => item.uuid)).toEqual(['4:5', '2:3'])
    expect(getProfileAgreementResponses(references, 'lin')).toEqual([])
    expect(getProfileAgreementResponses(references, 'che')).toEqual([])
    expect(getProfileAgreementResponses(references, 'unknown')).toEqual([])
  })

  test('counterpart selection keeps both directions across graphs without including an inheriting intermediary', () => {
    const nodes = [node(1, { agreementMarkdown: '保留实际结果' }),
      node(2, { parentUuid: '1', authorUuid: 'lin' }),
      node(3, { parentUuid: '2', authorUuid: 'miao', referenceAgreements: [satisfied(2)] }),
      node(4, { graphUuid: 'other', authorUuid: 'miao', agreementMarkdown: '记录锅具' }),
      node(5, { graphUuid: 'other', parentUuid: '4', referenceAgreements: [satisfied(4)] }),
      node(6, { parentUuid: '1', authorUuid: 'third', referenceAgreements: [satisfied(1)] })]
    const profile = getProfileAgreementResponses(getActionReferences(nodes), 'jo')
    const filtered = filterAgreementParticipants(profile, 'jo', 'miao')
    expect(filtered.map((item) => item.uuid)).toEqual(['4:5', '2:3'])
    expect(filterAgreementParticipants(profile, 'miao', 'jo')).toEqual(filtered)
    expect(filterAgreementParticipants(profile, 'miao')).toEqual(filtered)
    expect(filterAgreementParticipants(profile, undefined, 'miao')).toEqual(filtered)
    expect(filterAgreementParticipants(profile, 'jo', 'lin')).toEqual([])
    expect(filterAgreementParticipants(profile, 'jo', 'jo')).toEqual([])
    expect(filterAgreementParticipants(profile, 'unknown')).toEqual([])
    expect(filterAgreementParticipants(profile)).toBe(profile)
    expect(profile.map((item) => item.uuid)).toEqual(['1:6', '4:5', '2:3'])
    expect(filtered[0]).toBe(profile[1])
  })

  test('participant matching uses the actual editor of a modified agreement', () => {
    const nodes = [node(1, { agreementMarkdown: '新约定', agreementSupplement: { authorUuid: 'editor', createdAt: '2026-10-01T20:00:00+08:00', kind: 'modify' } }),
      node(2, { parentUuid: '1', authorUuid: 'lin', referenceAgreements: [satisfied(1)] })]
    const items = responses(nodes)
    expect(filterAgreementParticipants(items, 'editor', 'lin')).toEqual(items)
    expect(filterAgreementParticipants(items, 'jo', 'lin')).toEqual([])
  })
})
