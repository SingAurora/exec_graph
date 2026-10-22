import { http } from 'msw'
import { canFollowGraph } from '../../entities/following/lib/activity'
import { API_ERROR_CODES } from '../../shared/api/contracts'
import { mockAccount, type MockDatabase } from './database'
import { MockFailure, mockResponse, readBody, requireInput } from './protocol'

/** Handles explicit follow states, including server-side revalidation of undo actions. */
export function followingHandlers(db: MockDatabase) {
  return [
    http.get('*/api/commands/following/sources', mockResponse(db, () => db.following)),
    http.post('*/api/commands/following/set', mockResponse(db, async (request) => {
      const body = await readBody(request, ['kind', 'targetId', 'following'])
      requireInput((body.kind === 'user' || body.kind === 'graph') && typeof body.targetId === 'string' && typeof body.following === 'boolean')
      if (body.following && (body.kind === 'graph' ? !canFollowGraph(body.targetId, db.graphs, db.actions) : body.targetId === mockAccount(db).id || !db.users.some((user) => user.id === body.targetId))) {
        throw new MockFailure('对象已不可关注', API_ERROR_CODES.conflict, 409)
      }
      const key = body.kind === 'user' ? 'userIds' : 'graphIds'
      const ids = db.following[key]
      db.following[key] = body.following ? [...new Set([...ids, body.targetId])] : ids.filter((id) => id !== body.targetId)
      return db.following
    })),
  ]
}
