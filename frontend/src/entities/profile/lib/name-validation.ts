import { PROFILE_NAME_LIMIT } from '../model/limits'

/** 注册和资料编辑共用昵称规则；长度按 Unicode 码点计数，与服务端一致。 */
export function validateNickname(value: string): string | undefined {
  const name = value.trim()
  if (!name) return '请输入昵称'
  if ([...name].length > PROFILE_NAME_LIMIT) return `昵称最多 ${PROFILE_NAME_LIMIT} 个字符`
}
