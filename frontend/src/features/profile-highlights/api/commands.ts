import { postAPI, type BusinessRequestOptions } from '../../../shared/api/client'
import type { AccountProfile } from '../../../entities/profile/api/profiles'
import type { ProfileHighlights } from '../../../entities/profile/model/types'

/** 单独修改当前用户的主页精选，避免覆盖个人资料表单中的其他字段。 */
export type SetProfileHighlightsInput = ProfileHighlights & { expectedVersion: number }

/** 保存主页精选；服务端验证数量、文档归属和账户版本。 */
export function setProfileHighlights(input: SetProfileHighlightsInput, options: BusinessRequestOptions): Promise<AccountProfile> {
  return postAPI('/api/commands/profiles/highlights-set', input, options)
}
