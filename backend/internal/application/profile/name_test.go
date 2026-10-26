package profile

import (
	"strings"
	"testing"
)

func TestNicknameNormalization(t *testing.T) {
	for _, name := range []string{"小 明", "开发者👩‍💻", strings.Repeat("😀", 30)} {
		if actual, err := NormalizeName(" " + name + " "); err != nil || actual != name {
			t.Errorf("昵称码点计数或首尾空白处理错误: %v", err)
		}
	}
	for _, name := range []string{"", "   ", strings.Repeat("😀", 31), string([]byte{0xff})} {
		if _, err := NormalizeName(name); err == nil {
			t.Error("非法昵称被接受")
		}
	}
	for _, character := range []rune{'\n', '\t', '\u0000', '\u0085', '\u2028', '\u200b', '\u202e', '\u2066', '\ufeff'} {
		if _, err := NormalizeName("小" + string(character) + "明"); err == nil {
			t.Errorf("昵称接受了控制或不可见字符 U+%04X", character)
		}
	}
}
