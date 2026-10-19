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
    expect(getReferenceAgreementRecords([{ sourceId: 'source', nodeNumber: 2 }], readActionAgreementReviews([], sources))).toEqual([])
  })

  test('a published mismatch keeps its reason and produces an exception regardless of authorship', () => {
    const reviews = readActionAgreementReviews([{ nodeNumber: 2, complies: false, reason: '只尝了热时，没有静置' }, { nodeNumber: 7, complies: true, reason: '' }], sources)
    const referenceAgreements = getReferenceAgreementRecords([{ sourceId: 'first', nodeNumber: 2 }, { sourceId: 'merged', nodeNumber: 7 }], reviews)
    expect(referenceAgreements).toEqual([{ sourceId: 'first', complies: false, exceptionReason: '只尝了热时，没有静置' }, { sourceId: 'merged', complies: true }])
    for (const authorId of ['jo', 'lin']) {
      const nodes = [{ id: 'first', projectId: 'graph', number: 2, authorId: 'jo', agreementMarkdown: '静置十分钟' },
        { id: 'merged', projectId: 'graph', number: 7, authorId: 'lin', agreementMarkdown: '说明用时' },
        { id: 'published', projectId: 'graph', number: 9, authorId, parentId: 'first', mergedParentIds: ['merged'], referenceAgreements }]
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
