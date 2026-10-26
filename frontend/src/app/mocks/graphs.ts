import { http } from 'msw'
import { canDeleteProject, getProjectDeletionDisabledReason } from '../../entities/project/lib/permissions'
import { API_ERROR_CODES } from '../../shared/api/contracts'
import { mockAccount, type MockDatabase } from './database'
import { idempotent, MockFailure, mockResponse, readBody, requireCurrent, requireInput, requireResource, requireVersion } from './protocol'

/** Contract handlers for graph metadata and guarded graph writes. */
export function graphHandlers(db: MockDatabase) {
  return [
    http.get('*/api/commands/graphs/catalogue', mockResponse(db, () => db.graphs)),
    http.get('*/api/commands/graphs/detail', mockResponse(db, (request) => requireResource(db.graphs.find((graph) => graph.id === new URL(request.url).searchParams.get('graphId'))))),
    http.post('*/api/commands/graphs/create', mockResponse(db, async (request) => {
      const body = await readBody(request, ['title', 'description'])
      requireInput(typeof body.title === 'string' && body.title.trim().length > 0 && body.title.trim().length <= 60)
      requireInput(typeof body.description === 'string' && body.description.length <= 240)
      const title = body.title.trim(), description = body.description.trim()
      return idempotent(db, request, body, () => {
        const now = new Date().toISOString()
        const graph = { id: crypto.randomUUID(), ownerId: mockAccount(db).id, participantIds: [], title, description, createdAt: now, updatedAt: now, version: 1 }
        db.graphs.unshift(graph)
        return graph
      })
    })),
    http.post('*/api/commands/graphs/update', mockResponse(db, async (request) => {
      const body = await readBody(request, ['graphId', 'expectedVersion', 'title', 'description', 'avatarAssetId', 'backgroundAssetId'])
      const graph = requireResource(db.graphs.find((item) => item.id === body.graphId))
      requireVersion(graph.version, body.expectedVersion)
      const counts = new Map<string, number>()
      for (const action of db.actions.filter((node) => node.projectId === graph.id)) counts.set(action.authorId, (counts.get(action.authorId) ?? 0) + 1)
      const editors = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => id)
      if (graph.ownerId !== mockAccount(db).id && !editors.includes(mockAccount(db).id)) throw new MockFailure('没有编辑此图的权限', API_ERROR_CODES.forbidden, 403)
      requireInput(typeof body.title === 'string' && body.title.trim().length > 0 && body.title.trim().length <= 60)
      requireInput(typeof body.description === 'string' && body.description.length <= 240)
      requireInput(body.avatarAssetId === null && body.backgroundAssetId === null, '模拟环境不提供对象存储')
      Object.assign(graph, { title: body.title.trim(), description: body.description.trim(), avatar: undefined, backgroundImage: undefined, avatarAssetId: null, backgroundAssetId: null, updatedAt: new Date().toISOString(), version: graph.version + 1 })
      return graph
    })),
    http.post('*/api/commands/graphs/delete', mockResponse(db, async (request) => {
      const body = await readBody(request, ['graphId', 'expectedVersion', 'expectedNodeCount'])
      const graph = requireResource(db.graphs.find((item) => item.id === body.graphId))
      requireVersion(graph.version, body.expectedVersion)
      if (!canDeleteProject(graph, mockAccount(db).id, db.actions)) throw new MockFailure(getProjectDeletionDisabledReason(graph, mockAccount(db).id, db.actions)!, API_ERROR_CODES.forbidden, 403)
      requireInput(Number.isInteger(body.expectedNodeCount) && Number(body.expectedNodeCount) >= 0)
      requireCurrent(db.actions.filter((node) => node.projectId === graph.id).length === body.expectedNodeCount, '节点数量已变化，请重新确认删除')
      db.graphs = db.graphs.filter((item) => item.id !== graph.id)
      db.actions = db.actions.filter((node) => node.projectId !== graph.id)
      db.following.graphIds = db.following.graphIds.filter((id) => id !== graph.id)
      return null
    })),
  ]
}
