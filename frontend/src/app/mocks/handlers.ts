import { createMockDatabase, type MockDatabase } from './database'
import { graphHandlers } from './graphs'
import { actionHandlers } from './actions'
import { profileHandlers } from './profiles'
import { followingHandlers } from './following'

/** Builds isolated HTTP handlers; tests can create fresh server state for each scenario. */
export function createMockHandlers(database: MockDatabase = createMockDatabase()) {
  return [...profileHandlers(database), ...graphHandlers(database), ...actionHandlers(database), ...followingHandlers(database)]
}
