import { http } from 'msw'
import type { ActionContextNode } from '../../entities/action/api/context'
import { getActionContinuationContext } from '../../entities/action/lib/continuation'
import { updateActionExpressionFromConversation } from '../../entities/action/lib/expressions'
import { updateActionAgreement } from '../../entities/action/lib/agreements'
import { mockAccount, type MockDatabase } from './database'
import { documentMarkdown, readAssessments, readDocument, readMessages } from './action-input'
import { idempotent, mockResponse, readBody, requireCurrent, requireInput, requireResource, requireVersion } from './protocol'

function view({ projectId, ...node }: MockDatabase['actions'][number]): ActionContextNode { return { ...node, graphId: projectId } }

/** Scoped context and publication handlers validate against the simulated server's latest facts. */
export function actionHandlers(db: MockDatabase) {
  return [
    http.get('*/api/commands/actions/context', mockResponse(db, (request) => {
      const graphId = new URL(request.url).searchParams.get('graphId')
      requireResource(db.graphs.find((graph) => graph.id === graphId))
      return db.actions.filter((node) => node.projectId === graphId).map(view)
    })),
    http.get('*/api/commands/actions/detail', mockResponse(db, (request) => view(requireResource(db.actions.find((node) => node.id === new URL(request.url).searchParams.get('nodeId')))))),
    http.post('*/api/commands/actions/create', mockResponse(db, async (request) => {
      const body = await readBody(request, ['graphId', 'parentId', 'mergedParentIds', 'sourceVersions', 'title', 'objectiveMarkdown', 'expression', 'agreement', 'referenceAgreements', 'conversation'])
      return idempotent(db, request, body, () => {
        const graph = requireResource(db.graphs.find((item) => item.id === body.graphId))
        const nodes = db.actions.filter((node) => node.projectId === graph.id)
        requireInput(body.parentId === undefined || typeof body.parentId === 'string')
        requireInput(Array.isArray(body.mergedParentIds) && body.mergedParentIds.every((id) => typeof id === 'string'))
        const mergedParentIds = body.mergedParentIds as string[]
        const context = body.parentId ? getActionContinuationContext(nodes, body.parentId, mergedParentIds) : undefined
        requireCurrent(body.parentId ? context : nodes.length === 0 && mergedParentIds.length === 0, '引用来源已变化，请重新选择')
        const sourceIds = context?.sources.map(({ node }) => node.id) ?? []
        requireInput(Array.isArray(body.sourceVersions) && body.sourceVersions.length === sourceIds.length)
        const seen = new Set<string>()
        for (const source of body.sourceVersions) {
          requireInput(source && typeof source === 'object' && typeof source.nodeId === 'string' && sourceIds.includes(source.nodeId) && !seen.has(source.nodeId))
          seen.add(source.nodeId)
          requireVersion(requireResource(nodes.find((node) => node.id === source.nodeId)).version, source.version)
        }
        requireInput(typeof body.title === 'string' && body.title.trim() && typeof body.objectiveMarkdown === 'string' && body.objectiveMarkdown.trim())
        const expression = readDocument(body.expression), agreement = readDocument(body.agreement)
        requireInput(Boolean(body.parentId) || (expression.mode !== 'inherit' && agreement.mode !== 'inherit'), '首次行动没有可继承的内容')
        const conversation = readMessages(body.conversation)
        requireInput(conversation.at(-1)?.speaker === 'ai' && conversation.some((message) => message.speaker === 'user'), '请先完成 AI 对话')
        const node: MockDatabase['actions'][number] = {
          id: crypto.randomUUID(), projectId: graph.id, number: Math.max(0, ...nodes.map((item) => item.number)) + 1,
          parentId: body.parentId, mergedParentIds, authorId: mockAccount(db).id, title: body.title.trim(), markdown: body.objectiveMarkdown,
          objectiveMarkdown: body.objectiveMarkdown, expressionMarkdown: documentMarkdown(expression), agreementMarkdown: documentMarkdown(agreement),
          referenceAgreements: readAssessments(body.referenceAgreements, sourceIds), conversation, images: [], version: 1, createdAt: new Date().toISOString(),
          contextSnapshot: { directNodeIds: sourceIds, historyNodeCount: context?.facts.length ?? 0, guide: graph.contextGuide },
        }
        db.actions.unshift(node)
        return view(node)
      })
    })),
    ...(['expressions', 'agreements'] as const).map((kind) => http.post(`*/api/commands/${kind}/update`, mockResponse(db, async (request) => {
      const body = await readBody(request, ['nodeId', 'expectedVersion', 'document', ...(kind === 'expressions' ? ['conversation'] : [])])
      const node = requireResource(db.actions.find((item) => item.id === body.nodeId))
      requireVersion(node.version, body.expectedVersion)
      const document = readDocument(body.document)
      requireInput(document.mode !== 'inherit', '修改已有内容时需要明确更新或清空')
      const markdown = documentMarkdown(document) ?? ''
      const editor = { authorId: mockAccount(db).id, createdAt: new Date().toISOString() }
      const previous = node.expressionConversation ?? []
      const conversation = kind === 'expressions' ? readMessages(body.conversation) : []
      requireCurrent(kind !== 'expressions' || previous.every((message, index) => {
        const incoming = conversation[index]
        return incoming?.id === message.id && incoming.speaker === message.speaker && incoming.body === message.body
      }), '已有对话不能被覆盖，请刷新后继续')
      const attributed = conversation.map((message, index) => ({ ...message,
        ...(message.speaker === 'user' ? { authorId: index < previous.length ? previous[index].authorId ?? node.expressionSupplement?.authorId ?? node.authorId : editor.authorId } : {}),
      }))
      const updated = kind === 'expressions' ? updateActionExpressionFromConversation(db.actions, node.id, markdown, editor, attributed)
        : updateActionAgreement(db.actions, node.id, markdown, editor)
      requireCurrent(updated !== db.actions, '节点已有后续引用或内容未变化，无法保存')
      const next = { ...requireResource(updated.find((item) => item.id === node.id)), version: node.version + 1 }
      db.actions = db.actions.map((item) => item.id === node.id ? next : item)
      return view(next)
    }))),
  ]
}
