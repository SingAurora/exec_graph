/** 类似贴吧的公共社区空间，承载多人的表达与约定回应；创建图不自动生成第一次行动。 */
export type Graph = {
  uuid: string
  ownerUuid: string
  participantUuids: string[]
  title: string
  description: string
  avatar?: string
  avatarAssetUuid?: string | null
  backgroundAssetUuid?: string | null
  backgroundImage?: string
  createdAt: string
  updatedAt: string
  /** 旧版图级指引；当前不开放图级提示词编辑，也不注入生成提示词。 */
  contextGuide?: string
}

/** 根据已发布节点计算的图统计；资料更新时间不等于最近行动时间。 */
export type GraphActivity = {
  graph: Graph
  actionCount: number
  expressionCount: number
  participantCount: number
  lastActionAt?: string
}
