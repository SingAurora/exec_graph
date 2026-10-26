/** 用户自主排序的主页表达分支；约定由所选节点的有效约定派生，不另存选择。 */
export type ProfileHighlights = {
  expressionNodeIds: string[]
}

/** 原型界面共用的用户资料类型；公开接口不返回邮箱，只有当前账户接口提供本人邮箱。 */
export type UserProfile = {
  legacyId?: string
  id: string
  name: string
  email: string
  gender: 'male' | 'female' | 'unknown'
  bio: string
  avatar: string
  avatarAssetId?: string | null
  backgroundAssetId?: string | null
  backgroundImage?: string
  activeDays: number
  isTestAccount?: boolean
  highlights?: ProfileHighlights
}
