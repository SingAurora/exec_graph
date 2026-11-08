import { describe, expect, test } from 'bun:test'
import { getProfileHighlightCandidates } from './profile-highlights.ts'

const node = (id, patch = {}) => ({ uuid: id, id, authorId: 'jo', graphId: 'cooking', number: 1, createdAt: '2026-10-01T12:00:00Z', ...patch })

describe('profile highlight ownership and versions', () => {
  test('keeps a specific own branch with an effective own expression, including historical selections', () => {
    const source = node('source', { expressionMarkdown: '我愿意多花三分钟' })
    const inherited = node('inherited', { parentId: source.uuid })
    const cleared = node('cleared', { parentId: source.uuid, expressionMarkdown: '' })
    const changed = node('changed', { parentId: source.uuid, expressionMarkdown: '新的取舍', number: 2 })
    const nodes = [source, inherited, cleared, changed]
    expect(getProfileHighlightCandidates(nodes, 'jo').map(({ node }) => node.uuid)).toEqual(['changed', 'source', 'inherited'])
    expect(nodes.map(({ id }) => id)).toEqual(['source', 'inherited', 'cleared', 'changed'])
  })

  test('pairs expressions with inherited agreements, respecting clears, merges and graph boundaries', () => {
    const other = node('other', { authorId: 'lin', agreementMarkdown: '请记录锅具' })
    const own = node('own', { parentId: other.uuid, expressionMarkdown: '我愿意慢一点' })
    const merged = node('merged', { agreementMarkdown: '不能带入这个合入条件' })
    const inherited = node('inherited', { parentId: own.uuid, mergedParentIds: [merged.uuid] })
    const cleared = node('cleared', { parentId: own.uuid, agreementMarkdown: '' })
    const across = node('across', { graphId: 'reading', parentId: own.uuid, expressionMarkdown: '另一张图的表达' })
    const entries = getProfileHighlightCandidates([other, own, merged, inherited, cleared, across], 'jo')
    expect(entries.find(({ node }) => node.uuid === own.uuid).agreement).toEqual({ markdown: '请记录锅具', sourceNode: other })
    expect(entries.find(({ node }) => node.uuid === inherited.uuid).agreement.markdown).toBe('请记录锅具')
    expect(entries.find(({ node }) => node.uuid === cleared.uuid).agreement.markdown).toBe('')
    expect(entries.find(({ node }) => node.uuid === across.uuid).agreement.markdown).toBe('')
  })

  test('checks actual expression authors and never selects another person through inherited content', () => {
    const edited = node('edited', { authorId: 'lin', expressionMarkdown: '我的补充表达', expressionSupplement: { authorId: 'jo' } })
    const editedByOther = node('other-editor', { expressionMarkdown: '其他人的表达', expressionSupplement: { authorId: 'lin' } })
    const inheritedOther = node('inherited-other', { parentId: editedByOther.uuid })
    const foreignBranch = node('foreign-branch', { authorId: 'lin', parentId: edited.uuid })
    expect(getProfileHighlightCandidates([edited, editedByOther, inheritedOther, foreignBranch], 'jo').map(({ node }) => node.uuid)).toEqual(['edited'])
  })

  test('does not follow later branches and reflects edits and clears on the selected node', () => {
    const selected = node('selected', { expressionMarkdown: '原表达', agreementMarkdown: '原约定' })
    const later = node('later', { parentId: selected.uuid, expressionMarkdown: '后续表达', agreementMarkdown: '后续约定' })
    const readSelected = (nodes) => getProfileHighlightCandidates(nodes, 'jo').find(({ node }) => node.uuid === selected.uuid)
    expect(readSelected([selected, later]).agreement.markdown).toBe('原约定')
    expect(readSelected([{ ...selected, agreementMarkdown: '修改后的约定' }]).agreement.markdown).toBe('修改后的约定')
    expect(readSelected([{ ...selected, agreementMarkdown: '' }]).agreement.markdown).toBe('')
    expect(readSelected([{ ...selected, expressionMarkdown: '' }])).toBeUndefined()
    expect(readSelected([later])).toBeUndefined()
  })
})
