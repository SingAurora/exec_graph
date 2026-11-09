import type { UserProfile } from '../../profile/model/types'

/** 用户关注与图关注分别保存；关注一个图不等于关注图内所有人。 */
export type FollowedSources = {
  userUuids: string[]
  graphUuids: string[]
  /** 关注用户的公开资料，随关注集合返回，避免全局用户目录。 */
  users: UserProfile[]
}
