import { expect, test } from 'bun:test'
import { getNavigationPositionKey } from './navigation-position.ts'

test('the personal route and own public profile restore the same reading position', () => {
  expect(getNavigationPositionKey('my', 'jo')).toBe('my')
  expect(getNavigationPositionKey('profile?userId=jo', 'jo')).toBe('my')
  expect(getNavigationPositionKey('profile?userId=jo&fromGraph=cooking', 'jo')).toBe('my')
})

test('other users and explicit content deep links retain independent reading positions', () => {
  for (const hash of ['profile?userId=lin', 'profile?userId=jo&tab=actions', 'project?projectId=cooking', 'home']) {
    expect(getNavigationPositionKey(hash, 'jo')).toBe(hash)
  }
})
