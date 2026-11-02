import { PROFILE_BIO_LIMIT } from '../model/limits'

/** 简介按 Unicode 码点计数，与后端 utf8.RuneCountInString 一致；保存时会去掉首尾空白。 */
export function validateBiography(value: string): string | undefined {
  if ([...value.trim()].length > PROFILE_BIO_LIMIT) return `个人简介最多 ${PROFILE_BIO_LIMIT} 个字符`
}
