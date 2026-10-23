/** 用户关注与图关注分别保存；关注一个图不等于关注图内所有人。 */
export type FollowedSources = {
  userIds: string[]
  graphIds: string[]
}
