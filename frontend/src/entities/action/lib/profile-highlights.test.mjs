import { describe, expect, test } from 'bun:test'
import { getProfileHighlightCandidates } from './profile-highlights.ts'

const node = (id, patch = {}) => ({ id, authorId: 'jo', projectId: 'cooking', number: 1, createdAt: '2026-10-01T12:00:00Z', ...patch })

describe('profile highlight ownership and versions', () => {
  test('keeps a specific own branch with an effective own expression, including historical selections', () => {
    const source = node('source', { expressionMarkdown: '我愿意多花三分钟' })
    const inherited = node('inherited', { parentId: source.id })
    const cleared = node('cleared', { parentId: source.id, expressionMarkdown: '' })
    const changed = node('changed', { parentId: source.id, expressionMarkdown: '新的取舍', number: 2 })
    const nodes = [source, inherited, cleared, changed]
    expect(getProfileHighlightCandidates(nodes, 'jo').map(({ node }) => node.id)).toEqual(['changed', 'source', 'inherited'])
    expect(nodes.map(({ id }) => id)).toEqual(['source', 'inherited', 'cleared', 'changed'])
  })

  test('pairs expressions with inherited agreements, respecting clears, merges and graph boundaries', () => {
    const other = node('other', { authorId: 'lin', agreementMarkdown: '请记录锅具' })
    const own = node('own', { parentId: other.id, expressionMarkdown: '我愿意慢一点' })
    const merged = node('merged', { agreementMarkdown: '不能带入这个合入条件' })
    const inherited = node('inherited', { parentId: own.id, mergedParentIds: [merged.id] })
    const cleared = node('cleared', { parentId: own.id, agreementMarkdown: '' })
    const across = node('across', { projectId: 'reading', parentId: own.id, expressionMarkdown: '另一张图的表达' })
    const entries = getProfileHighlightCandidates([other, own, merged, inherited, cleared, across], 'jo')
    expect(entries.find(({ node }) => node.id === own.id).agreement).toEqual({ markdown: '请记录锅具', sourceNode: other })
    expect(entries.find(({ node }) => node.id === inherited.id).agreement.markdown).toBe('请记录锅具')
    expect(entries.find(({ node }) => node.id === cleared.id).agreement.markdown).toBe('')
    expect(entries.find(({ node }) => node.id === across.id).agreement.markdown).toBe('')
  })

  test('checks actual expression authors and never selects another person through inherited content', () => {
    const edited = node('edited', { authorId: 'lin', expressionMarkdown: '我的补充表达', expressionSupplement: { authorId: 'jo' } })
    const editedByOther = node('other-editor', { expressionMarkdown: '其他人的表达', expressionSupplement: { authorId: 'lin' } })
    const inheritedOther = node('inherited-other', { parentId: editedByOther.id })
    const foreignBranch = node('foreign-branch', { authorId: 'lin', parentId: edited.id })
    expect(getProfileHighlightCandidates([edited, editedByOther, inheritedOther, foreignBranch], 'jo').map(({ node }) => node.id)).toEqual(['edited'])
  })

  test('does not follow later branches and reflects edits and clears on the selected node', () => {
    const selected = node('selected', { expressionMarkdown: '原表达', agreementMarkdown: '原约定' })
    const later = node('later', { parentId: selected.id, expressionMarkdown: '后续表达', agreementMarkdown: '后续约定' })
    const readSelected = (nodes) => getProfileHighlightCandidates(nodes, 'jo').find(({ node }) => node.id === selected.id)
    expect(readSelected([selected, later]).agreement.markdown).toBe('原约定')
    expect(readSelected([{ ...selected, agreementMarkdown: '修改后的约定' }]).agreement.markdown).toBe('修改后的约定')
    expect(readSelected([{ ...selected, agreementMarkdown: '' }]).agreement.markdown).toBe('')
    expect(readSelected([{ ...selected, expressionMarkdown: '' }])).toBeUndefined()
    expect(readSelected([later])).toBeUndefined()
  })
})
