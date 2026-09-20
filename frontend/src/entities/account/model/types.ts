export type Gender = 'female' | 'male' | 'undisclosed'

export type Actor = {
  id: string
  name: string
  handle: string
  role: string
  bio?: string
  gender?: Gender
  avatarUrl?: string
  profileBackgroundUrl?: string
  customProfileEnabled?: boolean
  customProfileMarkdown?: string
}

/** 当前用户资料在客户端工作区中的可编辑快照。 */
export type CurrentUserProfileInput = {
  username: string
  userId: string
  bio: string
  gender: Gender
  avatarUrl?: string
  profileBackgroundUrl?: string
  customProfileEnabled?: boolean
  customProfileMarkdown?: string
}

/** 公开个人页允许匿名访问的用户资料。 */
export type PublicProfileUser = {
  username: string
  userId: string
  bio: string
  gender?: Gender
  avatarUrl?: string
  profileBackgroundUrl?: string
  customProfileEnabled: boolean
  customProfileMarkdown?: string
}

/** 公开个人页中的项目摘要。 */
export type PublicProfileProject = {
  uuid: string
  title: string
  description: string
  nodeCount: number
  completionCount: number
}

/** 公开个人页中由该用户形成的已验收成果。 */
export type PublicProfileCompletion = {
  uuid: string
  projectUuid: string
  projectTitle: string
  title: string
  summary: string
  coveredContractCount: number
  aiReviewVerdict: 'pass' | 'partial' | 'fail'
  createdAt: string
}

/** 公开个人页的完整只读投影。 */
export type PublicProfile = {
  user: PublicProfileUser
  projects: PublicProfileProject[]
  records: PublicProfileCompletion[]
  activeDays: number
}
