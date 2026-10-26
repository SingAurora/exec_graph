const encoder = new TextEncoder()
const unsafeCharacter = /[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}]/u

/** 按 UTF-8 字节计量输入，与服务端的字符串长度上限一致。 */
export function utf8Length(value: string): number {
  return encoder.encode(value).length
}

/** 拒绝控制、换行和不可见格式字符，保留文字及表情组合需要的连接字符。 */
export function hasUnsafeTextCharacters(value: string): boolean {
  return [...value].some((character) => character !== '\u200c' && character !== '\u200d' && unsafeCharacter.test(character))
}

/** 包含普通空格、不换行空格及全角空格等 Unicode 空白。 */
export function hasWhitespace(value: string): boolean {
  return /\p{White_Space}/u.test(value)
}
