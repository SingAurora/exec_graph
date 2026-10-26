import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { setupServer } from 'msw/node'
import { createMockDatabase } from './database.ts'
import { createMockHandlers } from './handlers.ts'
import { getAPI, postAPI } from '../../shared/api/client.ts'
import { readActionContexts } from '../../entities/action/api/context.ts'
import { createGraph, updateGraph, removeGraph } from '../../features/project/api/commands.ts'
import { createAction as confirmAction, reviseAgreement, reviseExpression as confirmExpression } from '../../features/action/api/commands.ts'
import { getActionExpression } from '../../entities/action/lib/expressions.ts'
import { getActionAgreement } from '../../entities/action/lib/agreements.ts'
import { setProfileHighlights } from '../../features/profile-highlights/api/commands.ts'
import { updateProfile } from '../../features/profile/api/commands.ts'

const { crypto, URL } = globalThis

const server = setupServer()
const originalLocation = Object.getOwnPropertyDescriptor(globalThis, 'location')
let db
const writeOptions = () => ({ csrfToken: db.csrfToken, idempotencyKey: crypto.randomUUID() })
const graphInput = { title: '接口测试图', description: '仅用于测试' }
const dialogue = [{ id: 'u1', speaker: 'user', body: '今天试做了一份炒蛋。' }, { id: 'a1', speaker: 'ai', body: '已整理行动记录。' }]
// 测试模型输出从模拟服务注入，不作为浏览器生成或发布参数。
async function createAction(fixture, options) {
  db.nextGenerationDraft = { reply: dialogue[1].body, title: fixture.title, objective: fixture.objectiveMarkdown, expression: fixture.expression, reviews: fixture.referenceAgreements }
  const generated = await postAPI('/api/commands/ai/generate', { mode: 'action', graphId: fixture.graphId, parentId: fixture.parentId,
    mergedParentIds: fixture.mergedParentIds, sourceVersions: fixture.sourceVersions, agreement: fixture.agreement, message: dialogue[0].body }, options)
  return confirmAction(generated.createAction, options)
}
async function reviseExpression(fixture, options) {
  db.nextGenerationDraft = { reply: '已整理表达。', title: '', objective: '', expression: fixture.document, reviews: [] }
  const node = db.actions.find((item) => item.id === fixture.nodeId)
  const generated = await postAPI('/api/commands/ai/generate', { mode: 'expression', graphId: node.projectId, nodeId: node.id, expectedVersion: fixture.expectedVersion,
    mergedParentIds: [], sourceVersions: [], agreement: { mode: 'inherit' }, message: fixture.conversation?.filter((item) => item.speaker === 'user').at(-1)?.body ?? '请调整表达。' }, options)
  return confirmExpression(generated.updateExpression, options)
}
const firstInput = (graphId) => ({ graphId, mergedParentIds: [], sourceVersions: [], title: '第一次试做', objectiveMarkdown: '实际做了一份炒蛋。',
  expression: { mode: 'update', markdown: '少放盐更合口味。' }, agreement: { mode: 'update', markdown: '请记录用盐量。' }, referenceAgreements: [], conversation: dialogue })
const createFirst = async () => {
  const graph = await createGraph(graphInput, writeOptions())
  const node = await createAction(firstInput(graph.id), writeOptions())
  return { graph, node }
}
const continueInput = (node, changes = {}) => ({ ...firstInput(node.graphId), parentId: node.id, sourceVersions: [{ nodeId: node.id, version: node.version }],
  expression: { mode: 'inherit' }, agreement: { mode: 'inherit' }, referenceAgreements: [{ sourceId: node.id, complies: null }], ...changes })
const failure = (status, code) => expect.objectContaining({ status, code })

beforeAll(async () => {
  Object.defineProperty(globalThis, 'location', { configurable: true, value: new URL('http://localhost') })
  server.listen({ onUnhandledRequest: 'error' })
})
beforeEach(() => { db = createMockDatabase(); server.resetHandlers(...createMockHandlers(db)) })
afterAll(async () => {
  await server.close()
  if (originalLocation) Object.defineProperty(globalThis, 'location', originalLocation)
  else delete globalThis.location
})

describe('HTTP mock contract through the real request client', () => {
  test('reads private session separately from public profiles and adapts graph identities', async () => {
    const session = await getAPI('/api/commands/auth/session')
    expect(session.user.email).toBeTruthy()
    const profiles = await getAPI('/api/commands/profiles/catalogue')
    expect(profiles.every((user) => !('email' in user) && !('isTestAccount' in user))).toBe(true)
    const nodes = await readActionContexts(['cooking'])
    expect(nodes.length).toBeGreaterThan(0)
    expect(nodes.every((node) => node.projectId === 'cooking' && node.version === 1 && !('graphId' in node))).toBe(true)
  })

  test('replays one creation and rejects reuse of its submission key for different content', async () => {
    const options = writeOptions()
    const [a, b] = await Promise.all([createGraph(graphInput, options), createGraph(graphInput, options)])
    expect(a).toEqual(b)
    expect(a.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(db.graphs.filter((graph) => graph.id === a.id)).toHaveLength(1)
    await expect(createGraph({ ...graphInput, title: '不同内容' }, options)).rejects.toMatchObject(failure(409, 10005))
  })

  test('rejects missing CSRF, unknown fields and client-assigned identity', async () => {
    await expect(createGraph(graphInput, { idempotencyKey: crypto.randomUUID() })).rejects.toMatchObject(failure(403, 10003))
    await expect(postAPI('/api/commands/graphs/create', { ...graphInput, id: 'client-id' }, writeOptions())).rejects.toMatchObject(failure(400, 10001))
  })

  test('updates confirmed versions and preserves newer data on a stale save', async () => {
    const graph = await createGraph(graphInput, writeOptions())
    const input = { graphId: graph.id, expectedVersion: 1, ...graphInput, title: '已保存的新标题', avatarAssetId: null, backgroundAssetId: null }
    const updated = await updateGraph(input, writeOptions())
    expect(updated.version).toBe(2)
    await expect(updateGraph({ ...input, title: '旧版本覆盖' }, writeOptions())).rejects.toMatchObject(failure(409, 10005))
    expect((await getAPI('/api/commands/graphs/detail', { graphId: graph.id })).title).toBe('已保存的新标题')
  })

  test('deletes empty graphs, checks node counts, and rejects shared-graph deletion', async () => {
    const graph = await createGraph(graphInput, writeOptions())
    await expect(removeGraph({ graphId: graph.id, expectedVersion: 1, expectedNodeCount: 1 }, writeOptions())).rejects.toMatchObject(failure(409, 10005))
    expect(await removeGraph({ graphId: graph.id, expectedVersion: 1, expectedNodeCount: 0 }, writeOptions())).toBeNull()
    await expect(getAPI('/api/commands/graphs/detail', { graphId: graph.id })).rejects.toMatchObject(failure(404, 10004))
    await expect(removeGraph({ graphId: 'cooking', expectedVersion: 1, expectedNodeCount: 0 }, writeOptions())).rejects.toMatchObject(failure(403, 10003))
  })

  test('first action can be empty, retry is idempotent even after its graph gains a node', async () => {
    const graph = await createGraph(graphInput, writeOptions())
    const input = { ...firstInput(graph.id), expression: { mode: 'clear' }, agreement: { mode: 'clear' } }
    const options = writeOptions()
    const node = await createAction(input, options)
    expect(node.number).toBe(1)
    expect(node.expressionMarkdown).toBe('')
    expect(await createAction(input, options)).toEqual(node)
    await expect(createAction(input, writeOptions())).rejects.toMatchObject(failure(409, 10005))
    expect(db.actions.filter((item) => item.projectId === graph.id)).toHaveLength(1)
  })

  test('inheritance and explicit clearing remain distinct across complete contexts', async () => {
    const { graph, node } = await createFirst()
    const inherited = await createAction(continueInput(node), writeOptions())
    const cleared = await createAction(continueInput(inherited, { expression: { mode: 'clear' }, agreement: { mode: 'clear' } }), writeOptions())
    const nodes = await readActionContexts([graph.id])
    expect(getActionExpression(nodes, inherited.id).markdown).toBe(node.expressionMarkdown)
    expect(getActionAgreement(nodes, inherited.id).markdown).toBe(node.agreementMarkdown)
    expect(getActionExpression(nodes, cleared.id).markdown).toBe('')
    expect(getActionAgreement(nodes, cleared.id).markdown).toBe('')
    expect(cleared.number).toBe(3)
  })

  test('source version and endpoint checks run against server facts', async () => {
    const { node } = await createFirst()
    const updated = await reviseAgreement({ nodeId: node.id, expectedVersion: 1, document: { mode: 'update', markdown: '记录具体克数。' } }, writeOptions())
    await expect(createAction(continueInput(node), writeOptions())).rejects.toMatchObject(failure(409, 10005))
    await createAction(continueInput(updated), writeOptions())
    await expect(reviseExpression({ nodeId: node.id, expectedVersion: 2, document: { mode: 'clear' }, conversation: dialogue }, writeOptions())).rejects.toMatchObject(failure(409, 10005))
  })

  test('noncompliance is recorded without approval; unknown is never treated as compliance', async () => {
    const { node } = await createFirst()
    const unknown = await createAction(continueInput(node), writeOptions())
    expect(unknown.referenceAgreements).toEqual([])
    const invalid = continueInput(node, { referenceAgreements: [{ sourceId: node.id, complies: false }] })
    await expect(createAction(invalid, writeOptions())).rejects.toMatchObject(failure(400, 10001))
    const result = await createAction({ ...invalid, referenceAgreements: [{ sourceId: node.id, complies: false, exceptionReason: '这次忘了称重。' }] }, writeOptions())
    expect(result.referenceAgreements[0].complies).toBe(false)
  })

  test('profile writes cannot change email and explicit follow state is idempotent', async () => {
    await expect(postAPI('/api/commands/profiles/update', { expectedVersion: 1, email: 'other@example.com' }, writeOptions())).rejects.toMatchObject(failure(400, 10001))
    const targetId = db.users[1].id
    const input = { kind: 'user', targetId, following: true }
    await postAPI('/api/commands/following/set', input, writeOptions())
    const followed = await postAPI('/api/commands/following/set', input, writeOptions())
    expect(followed.userIds.filter((id) => id === targetId)).toHaveLength(1)
    const unfollowed = await postAPI('/api/commands/following/set', { ...input, following: false }, writeOptions())
    expect(unfollowed.userIds).not.toContain(targetId)
  })

  test('saves ordered profile highlights publicly and preserves them when editing profile details', async () => {
    const first = await createFirst()
    const second = await createFirst()
    const highlights = { expressionNodeIds: [second.node.id, first.node.id] }
    const user = await setProfileHighlights({ ...highlights, expectedVersion: 1 }, writeOptions())
    expect(user.version).toBe(2)
    expect(user.highlights).toEqual(highlights)
    const publicUser = (await getAPI('/api/commands/profiles/catalogue')).find((item) => item.id === user.id)
    expect(publicUser.highlights).toEqual(highlights)
    expect(publicUser.email).toBeUndefined()
    const updated = await updateProfile({ expectedVersion: 2, name: user.name, gender: user.gender, bio: '新的个人简介', avatarAssetId: null, backgroundAssetId: null }, writeOptions())
    expect(updated.highlights).toEqual(highlights)
    const reordered = await setProfileHighlights({ expressionNodeIds: [first.node.id, second.node.id], expectedVersion: 3 }, writeOptions())
    expect(reordered.highlights.expressionNodeIds).toEqual([first.node.id, second.node.id])
    const removed = await setProfileHighlights({ expressionNodeIds: [second.node.id], expectedVersion: 4 }, writeOptions())
    expect(removed.highlights.expressionNodeIds).toEqual([second.node.id])
    const cleared = await setProfileHighlights({ expressionNodeIds: [], expectedVersion: 5 }, writeOptions())
    expect(cleared.highlights).toEqual({ expressionNodeIds: [] })
    expect(cleared.bio).toBe('新的个人简介')
  })

  test('rejects invalid highlight ownership, empty content, duplicates and limits atomically', async () => {
    const previousHighlights = globalThis.structuredClone(db.users[0].highlights)
    const { node } = await createFirst()
    const base = { expressionNodeIds: [node.id], expectedVersion: 1 }
    const foreign = db.actions.find((item) => item.authorId !== db.users[0].id && item.expressionMarkdown?.trim())
    expect(foreign).toBeTruthy()
    for (const patch of [
      { expressionNodeIds: [node.id, node.id] },
      { expressionNodeIds: [node.id, 'b', 'c', 'd', 'e', 'f'] },
      { expressionNodeIds: [foreign.id] },
      { expressionNodeIds: ['missing'] },
      { expressionNodeIds: [null] },
      { expressionNodeIds: null },
      { expressionNodeIds: undefined },
      { agreementNodeIds: [node.id] },
    ]) await expect(setProfileHighlights({ ...base, ...patch }, writeOptions())).rejects.toMatchObject(failure(400, 10001))
    db.actions.find((item) => item.id === node.id).expressionMarkdown = ''
    await expect(setProfileHighlights(base, writeOptions())).rejects.toMatchObject(failure(400, 10001))
    expect(db.users[0].highlights).toEqual(previousHighlights)
    expect(db.users[0].version).toBe(1)
  })

  test('highlight writes require CSRF and reject stale versions without overwriting the confirmed selection', async () => {
    const { node } = await createFirst()
    const input = { expressionNodeIds: [node.id], expectedVersion: 1 }
    await expect(setProfileHighlights(input, {})).rejects.toMatchObject(failure(403, 10003))
    await setProfileHighlights(input, writeOptions())
    await expect(setProfileHighlights({ ...input, expressionNodeIds: [] }, writeOptions())).rejects.toMatchObject(failure(409, 10005))
    expect((await getAPI('/api/commands/auth/session')).user.highlights.expressionNodeIds).toEqual([node.id])
  })

  test('accepts exactly five branch selections and rejects a sixth without changing the saved order', async () => {
    const ids = []
    for (let index = 0; index < 6; index += 1) ids.push((await createFirst()).node.id)
    const saved = await setProfileHighlights({ expressionNodeIds: ids.slice(0, 5), expectedVersion: 1 }, writeOptions())
    expect(saved.highlights.expressionNodeIds).toEqual(ids.slice(0, 5))
    await expect(setProfileHighlights({ expressionNodeIds: ids, expectedVersion: 2 }, writeOptions())).rejects.toMatchObject(failure(400, 10001))
    expect((await getAPI('/api/commands/auth/session')).user.highlights).toEqual(saved.highlights)
  })

  test('expression revisions preserve the continuous dialogue and server-confirmed authors', async () => {
    const { node } = await createFirst()
    const document = { mode: 'update', markdown: '经过复做，我愿意再调整一次。' }
    const first = await reviseExpression({ nodeId: node.id, expectedVersion: 1, document, conversation: dialogue }, writeOptions())
    expect(first.conversation.map(({ speaker, body }) => ({ speaker, body }))).toEqual(dialogue.map(({ speaker, body }) => ({ speaker, body })))
    expect(first.expressionConversation[0].authorId).toBe(db.users[0].id)
    const continued = [...first.expressionConversation, { id: 'u2', speaker: 'user', body: '继续修改', authorId: 'forged-author' }, { id: 'a2', speaker: 'ai', body: '再次整理' }]
    const second = await reviseExpression({ nodeId: node.id, expectedVersion: 2, document: { mode: 'clear' }, conversation: continued }, writeOptions())
    expect(second.expressionConversation[0].authorId).toBe(db.users[0].id)
    expect(second.expressionConversation[2].authorId).toBe(db.users[0].id)
    await expect(postAPI('/api/commands/expressions/update', { nodeId: node.id, expectedVersion: 3, document, conversation: dialogue }, writeOptions())).rejects.toMatchObject(failure(400, 10001))
    await expect(postAPI('/api/commands/actions/create', { ...firstInput(node.graphId), generationId: crypto.randomUUID() }, writeOptions())).rejects.toMatchObject(failure(400, 10001))
  })
})
