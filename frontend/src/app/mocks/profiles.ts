import { http } from 'msw'
import { mockAccount, type MockDatabase } from './database'
import { mockResponse, readBody, requireInput, requireVersion } from './protocol'

/** Current-account and public-profile handlers keep account email out of public responses. */
export function profileHandlers(db: MockDatabase) {
  return [
    http.get('*/api/commands/auth/session', mockResponse(db, () => ({ user: mockAccount(db), csrfToken: db.csrfToken }))),
    http.get('*/api/commands/profiles/catalogue', mockResponse(db, () => db.users.map((user) => ({
      id: user.id, name: user.name, gender: user.gender, bio: user.bio, avatar: user.avatar, backgroundImage: user.backgroundImage, activeDays: user.activeDays,
    })))),
    http.post('*/api/commands/profiles/update', mockResponse(db, async (request) => {
      const body = await readBody(request, ['name', 'gender', 'bio', 'avatar', 'backgroundImage', 'expectedVersion'])
      const user = mockAccount(db)
      requireVersion(user.version, body.expectedVersion)
      requireInput(typeof body.name === 'string' && body.name.trim().length > 0 && body.name.trim().length <= 30)
      requireInput(typeof body.bio === 'string' && body.bio.length <= 1000 && typeof body.avatar === 'string')
      requireInput(body.gender === 'unknown' || body.gender === 'male' || body.gender === 'female')
      requireInput(body.backgroundImage === undefined || typeof body.backgroundImage === 'string')
      Object.assign(user, { name: body.name.trim(), gender: body.gender, bio: body.bio, avatar: body.avatar, backgroundImage: body.backgroundImage, version: user.version + 1 })
      return user
    })),
  ]
}
