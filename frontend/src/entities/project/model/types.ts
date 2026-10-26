/** 类似贴吧的公共社区空间，承载多人的表达与约定回应；创建图不自动生成第一次行动。 */
export type Project = {
  legacyId?: string
  id: string
  ownerId: string
  participantIds: string[]
  title: string
  description: string
  avatar?: string
  avatarAssetId?: string | null
  backgroundAssetId?: string | null
  backgroundImage?: string
  createdAt: string
  updatedAt: string
  /** 整理行动时提供给 AI 的图级背景指引，修改它不回写历史节点。 */
  contextGuide?: string
}

/** 根据已发布节点计算的图统计；资料更新时间不等于最近行动时间。 */
export type GraphActivity = {
  project: Project
  actionCount: number
  expressionCount: number
  participantCount: number
  lastActionAt?: string
}
