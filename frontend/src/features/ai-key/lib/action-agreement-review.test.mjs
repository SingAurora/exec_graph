import { describe, expect, test } from 'bun:test'
import { getReferenceAgreementRecords, readActionAgreementReviews } from './action-agreement-review.ts'
import { getActionReferences } from '../../../entities/action/lib/references.ts'

const sources = [{ nodeNumber: 2, markdown: '静置十分钟' }, { nodeNumber: 7, markdown: '说明用时' }]

describe('source agreement assessments when publishing an action', () => {
  test('retains unknown assessments and validates only effective direct source conditions', () => {
    expect(readActionAgreementReviews(undefined, sources)).toEqual([
      { nodeNumber: 2, complies: null, reason: '' }, { nodeNumber: 7, complies: null, reason: '' },
    ])
    expect(readActionAgreementReviews([], [{ nodeNumber: 1, markdown: ' ' }])).toEqual([])
    expect(getReferenceAgreementRecords([{ sourceUuid: 'source', nodeNumber: 2 }], readActionAgreementReviews([], sources))).toEqual([])
  })

  test('a published mismatch keeps its reason and produces an exception regardless of authorship', () => {
    const reviews = readActionAgreementReviews([{ nodeNumber: 2, complies: false, reason: '只尝了热时，没有静置' }, { nodeNumber: 7, complies: true, reason: '' }], sources)
    const referenceAgreements = getReferenceAgreementRecords([{ sourceUuid: 'first', nodeNumber: 2 }, { sourceUuid: 'merged', nodeNumber: 7 }], reviews)
    expect(referenceAgreements).toEqual([{ sourceUuid: 'first', complies: false, exceptionReason: '只尝了热时，没有静置' }, { sourceUuid: 'merged', complies: true }])
    for (const authorUuid of ['jo', 'lin']) {
      const nodes = [{ uuid: 'first', id: 'first', graphUuid: 'graph', number: 2, authorUuid: 'jo', agreementMarkdown: '静置十分钟' },
        { uuid: 'merged', id: 'merged', graphUuid: 'graph', number: 7, authorUuid: 'lin', agreementMarkdown: '说明用时' },
        { uuid: 'published', id: 'published', graphUuid: 'graph', number: 9, authorUuid, parentUuid: 'first', mergedParentUuids: ['merged'], referenceAgreements }]
      const references = getActionReferences(nodes)
      expect(references.map((reference) => reference.agreementStatus)).toEqual(['exception', 'satisfied'])
      expect(references[0].exceptionReason).toBe('只尝了热时，没有静置')
      expect(references[0]).not.toHaveProperty('authorization')
    }
  })

  test('rejects extra sources, duplicate sources, invalid states and missing mismatch reasons', () => {
    for (const value of [{}, [null], [{ nodeNumber: 99, complies: true, reason: '' }],
      [{ nodeNumber: 2, complies: true, reason: '' }, { nodeNumber: 2, complies: false, reason: '重复' }],
      [{ nodeNumber: 2, complies: 'true', reason: '' }], [{ nodeNumber: 2, complies: false, reason: '  ' }]]) {
      expect(() => readActionAgreementReviews(value, sources)).toThrow('约定核对')
    }
  })
})
