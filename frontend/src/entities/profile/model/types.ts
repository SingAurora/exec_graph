/** 原型界面共用的用户资料类型；公开接口不返回邮箱，只有当前账户接口提供本人邮箱。 */
export type UserProfile = {
  id: string
  name: string
  email: string
  gender: 'male' | 'female' | 'unknown'
  bio: string
  avatar: string
  backgroundImage?: string
  activeDays: number
  isTestAccount?: boolean
}
