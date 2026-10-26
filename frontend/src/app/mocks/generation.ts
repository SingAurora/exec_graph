import { http } from 'msw'
import type { GenerateInput, GenerationView } from '../../features/action-generation/api/generation'
import { canEditActionExpression } from '../../entities/action/lib/expressions'
import { getActionContinuationContext } from '../../entities/action/lib/continuation'
import type { MockDatabase } from './database'
import { idempotent, mockResponse, readBody, requireCurrent, requireInput, requireResource, requireVersion } from './protocol'
import { readDocument } from './action-input'

/** 显式开发模拟：固定模型替身保存在模拟服务，浏览器不能提交成稿或伪造对话。 */
export function generationHandlers(db: MockDatabase) {
  return [
    http.post('*/api/commands/ai/generate', mockResponse(db, async (request) => {
      const body = await readBody(request, ['mode', 'graphId', 'conversationId', 'nodeId', 'expectedVersion', 'message', 'parentId', 'mergedParentIds', 'sourceVersions', 'agreement'])
      return idempotent(db, request, body, () => {
        requireInput(body.mode === 'action' || body.mode === 'expression')
        requireInput(typeof body.message === 'string' && body.message.trim())
        const graph = requireResource(db.graphs.find((graph) => graph.id === body.graphId))
        requireInput(Array.isArray(body.mergedParentIds) && Array.isArray(body.sourceVersions))
        const nodes = db.actions.filter((node) => node.projectId === graph.id)
        const context = body.mode === 'action' && typeof body.parentId === 'string' ? getActionContinuationContext(nodes, body.parentId, body.mergedParentIds as string[]) : undefined
        if (body.mode === 'action') requireCurrent(body.parentId ? context : !nodes.length && !body.mergedParentIds.length, '引用来源已变化，请重新选择')
        else {
          const node = requireResource(nodes.find((node) => node.id === body.nodeId))
          requireVersion(node.version, body.expectedVersion)
          requireCurrent(canEditActionExpression(nodes, node.id), '节点已有后续引用，无法保存')
          requireInput(body.mergedParentIds.length === 0 && body.sourceVersions.length === 0 && !body.parentId)
        }
        const sources = context?.sources.map(({ node }) => node.id) ?? []
        requireInput(body.sourceVersions.length === sources.length)
        const seen = new Set<string>()
        for (const source of body.sourceVersions) {
          requireInput(source && typeof source === 'object' && typeof source.nodeId === 'string' && sources.includes(source.nodeId) && !seen.has(source.nodeId))
          seen.add(source.nodeId)
          requireVersion(requireResource(nodes.find((node) => node.id === source.nodeId)).version, source.version)
        }
        const agreement = readDocument(body.agreement)
        requireInput(body.mode !== 'action' || body.parentId || agreement.mode !== 'inherit')
        const input = body as GenerateInput
        const previous = input.conversationId ? [...db.generations.values()].find((item) => item.view.conversationId === input.conversationId) : undefined
        if (input.conversationId) requireResource(previous)
        const generationId = crypto.randomUUID(), conversationId = previous?.view.conversationId ?? crypto.randomUUID()
        const draft = db.nextGenerationDraft ?? { reply: '已整理。', title: '行动记录', objective: input.message,
          expression: { mode: input.parentId ? 'inherit' as const : 'clear' as const }, reviews: sources.map((sourceId) => ({ sourceId, complies: null })) }
        db.nextGenerationDraft = undefined
        const view: GenerationView = { generationId, conversationId, status: 'succeeded', draft,
          ...(input.mode === 'action' ? { createAction: { graphId: graph.id, generationId, parentId: input.parentId, mergedParentIds: input.mergedParentIds, sourceVersions: input.sourceVersions, referenceAgreements: draft.reviews, images: [] } }
            : { updateExpression: { nodeId: input.nodeId!, expectedVersion: input.expectedVersion!, generationId } }) }
        db.generations.set(generationId, { input, view, used: false, messages: [...(previous?.messages ?? []),
          { id: crypto.randomUUID(), speaker: 'user', body: input.message }, { id: crypto.randomUUID(), speaker: 'ai', body: draft.reply }] })
        return view
      })
    })),
    http.get('*/api/commands/ai/generation', mockResponse(db, (request) => requireResource(db.generations.get(new URL(request.url).searchParams.get('generationId') ?? '')).view)),
  ]
}
