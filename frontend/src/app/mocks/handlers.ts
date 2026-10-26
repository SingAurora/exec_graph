import { createMockDatabase, type MockDatabase } from './database'
import { graphHandlers } from './graphs'
import { actionHandlers } from './actions'
import { profileHandlers } from './profiles'
import { followingHandlers } from './following'
import { generationHandlers } from './generation'

/** 按领域组装模拟接口，共享一份模拟会话；测试可传入独立数据以隔离场景。 */
export function createMockHandlers(database: MockDatabase = createMockDatabase()) {
  return [...profileHandlers(database), ...graphHandlers(database), ...actionHandlers(database), ...followingHandlers(database), ...generationHandlers(database)]
}
