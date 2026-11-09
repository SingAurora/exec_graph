/** 用户自主排序的主页表达分支；约定由所选节点的有效约定派生，不另存选择。 */
export type ProfileHighlights = {
  expressionNodeUuids: string[]
}

/** 中国大陆省、市、区县三级公开地址。只保存区县代码，名称由服务端返回。 */
export type ProfileLocation = {
	code: string
	provinceCode: string
	province: string
	cityCode: string
	city: string
	districtCode: string
	district: string
}

/** 原型界面共用的用户资料类型；演示阶段公开接口也返回邮箱。 */
export type UserProfile = {
  uuid: string
  name: string
  email: string
  gender: 'male' | 'female' | 'unknown'
  bio: string
	location?: ProfileLocation
  avatar: string
  avatarAssetUuid?: string | null
  backgroundAssetUuid?: string | null
  backgroundImage?: string
  activeDays: number
  isTestAccount?: boolean
  highlights?: ProfileHighlights
  recentActionAt?: string
}
