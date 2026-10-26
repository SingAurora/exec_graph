import { http } from 'msw'
import { mockAccount, type MockDatabase } from './database'
import { mockResponse, readBody, requireInput, requireVersion } from './protocol'
import { getProfileHighlightCandidates } from '../../entities/action/lib/profile-highlights'
import { profileHighlightLimit } from '../../entities/profile/model/highlights'

/** Current-account and public-profile handlers keep account email out of public responses. */
export function profileHandlers(db: MockDatabase) {
  return [
    http.get('*/api/commands/auth/session', mockResponse(db, () => ({ user: mockAccount(db), csrfToken: db.csrfToken }))),
    http.get('*/api/commands/profiles/catalogue', mockResponse(db, () => db.users.map((user) => ({
      id: user.id, name: user.name, gender: user.gender, bio: user.bio, avatar: user.avatar, backgroundImage: user.backgroundImage, activeDays: user.activeDays, highlights: user.highlights,
    })))),
    http.post('*/api/commands/profiles/update', mockResponse(db, async (request) => {
      const body = await readBody(request, ['name', 'gender', 'bio', 'avatarAssetId', 'backgroundAssetId', 'expectedVersion'])
      const user = mockAccount(db)
      requireVersion(user.version, body.expectedVersion)
      requireInput(typeof body.name === 'string' && body.name.trim().length > 0 && body.name.trim().length <= 30)
      requireInput(typeof body.bio === 'string' && body.bio.length <= 1000)
      requireInput(body.gender === 'unknown' || body.gender === 'male' || body.gender === 'female')
      requireInput(body.avatarAssetId === null && body.backgroundAssetId === null, '模拟环境不提供对象存储')
      Object.assign(user, { name: body.name.trim(), gender: body.gender, bio: body.bio, avatar: '', backgroundImage: undefined, avatarAssetId: null, backgroundAssetId: null, version: user.version + 1 })
      return user
    })),
    http.post('*/api/commands/profiles/highlights-set', mockResponse(db, async (request) => {
      const body = await readBody(request, ['expressionNodeIds', 'expectedVersion'])
      const user = mockAccount(db)
      requireVersion(user.version, body.expectedVersion)
      const expressionNodeIds = body.expressionNodeIds
      requireInput(Array.isArray(expressionNodeIds) && expressionNodeIds.length <= profileHighlightLimit, `最多精选 ${profileHighlightLimit} 个表达`)
      const candidates = new Set(getProfileHighlightCandidates(db.actions, user.id).map(({ node }) => node.id))
      requireInput(expressionNodeIds.every((id): id is string => typeof id === 'string' && candidates.has(id)), '只能精选本人分支上的非空本人表达')
      requireInput(new Set(expressionNodeIds).size === expressionNodeIds.length, '不能重复精选同一条表达')
      user.highlights = { expressionNodeIds }
      user.version += 1
      return user
    })),
  ]
}
