// Package textinput 提供与业务无关的 Unicode 输入字符检查。
package textinput

import "unicode"

// HasUnsafeCharacters 检查控制、换行和不可见格式字符，保留文字和表情需要的连接字符。
func HasUnsafeCharacters(value string) bool {
	for _, character := range value {
		if character == '\u200c' || character == '\u200d' {
			continue
		}
		if unicode.IsControl(character) || unicode.In(character, unicode.Cf, unicode.Zl, unicode.Zp) {
			return true
		}
	}
	return false
}
