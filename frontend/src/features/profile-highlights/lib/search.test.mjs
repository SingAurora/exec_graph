import { describe, expect, test } from 'bun:test'
import { searchHighlightCandidates } from './search.ts'

const entry = (id, patch = {}) => ({
  node: { uuid: id, id, title: `行动 ${id}`, graphId: 'cooking', number: 1 },
  markdown: '普通表达', agreement: { markdown: '' }, ...patch,
})
const graphs = [{ uuid: 'cooking', id: 'cooking', title: '厨房复做' }, { uuid: 'cycling', id: 'cycling', title: '周末骑行' }]

describe('profile highlight candidate search', () => {
  test('searches the full candidate set beyond the first displayed batch without changing order', () => {
    const entries = Array.from({ length: 15 }, (_, index) => entry(`${index}`, { markdown: index > 6 ? '摄影与骑行' : '厨房记录' }))
    expect(searchHighlightCandidates(entries, graphs, '骑行').map(({ node }) => node.uuid)).toEqual(['7', '8', '9', '10', '11', '12', '13', '14'])
    expect(entries[0].node.uuid).toBe('0')
    expect(searchHighlightCandidates(entries, graphs, '  ')).toBe(entries)
  })

  test('matches visible expression text, action titles, inherited agreements, graph names and node numbers', () => {
    const entries = [
      entry('expression', { markdown: '**先看食材状态**' }),
      entry('action', { node: { uuid: 'action', id: 'action', title: '记录桌游体验', graphId: 'cooking', number: 12 } }),
      entry('agreement', { agreement: { markdown: '请留下真实用时', sourceNode: { authorId: 'other' } } }),
      entry('graph', { node: { uuid: 'graph', id: 'graph', title: '一次出发', graphId: 'cycling', number: 3 } }),
    ]
    for (const [query, id] of [['食材状态', 'expression'], ['桌游', 'action'], ['真实用时', 'agreement'], ['周末骑行', 'graph'], ['#12', 'action']]) {
      expect(searchHighlightCandidates(entries, graphs, query).map(({ node }) => node.uuid)).toEqual([id])
    }
  })

  test('treats keywords literally, ignores case and surrounding whitespace, and keeps empty results empty', () => {
    const entries = [entry('literal', { markdown: '一次 AI [v2] 的体验' }), entry('other')]
    expect(searchHighlightCandidates(entries, graphs, ' ai [V2] ').map(({ node }) => node.uuid)).toEqual(['literal'])
    expect(searchHighlightCandidates(entries, graphs, '.*')).toEqual([])
    expect(searchHighlightCandidates(entries, graphs, '不存在的内容')).toEqual([])
  })
})
