package account

import (
	"strings"
	"testing"
)

func TestNewPasswordRules(t *testing.T) {
	for _, password := range []string{"Ab!'\"\\;9", "中文密码测试八位", strings.Repeat("😀", 8), strings.Repeat("é", 128), strings.Repeat("😀", 64), "开发者👩‍💻的密码"} {
		if err := validateNewPassword(password); err != nil {
			t.Errorf("合法的符号或 Unicode 密码被拒绝: %v", err)
		}
	}
	for _, password := range []string{"", "1234567", strings.Repeat("😀", 7), strings.Repeat("a", 257), strings.Repeat("é", 129), strings.Repeat("😀", 65), string([]byte{0xff}) + "password"} {
		if err := validateNewPassword(password); err == nil {
			t.Error("非法长度或编码的密码被接受")
		}
	}
	for _, character := range []rune{' ', '\t', '\n', '\u00a0', '\u0085', '\u3000', '\u2028', '\u0000', '\u007f', '\u200b', '\u202e', '\u2066', '\ufeff'} {
		if err := validateNewPassword("pass" + string(character) + "word"); err == nil {
			t.Errorf("接受了空白或不可见字符 U+%04X", character)
		}
	}
}

func TestEmailLengthAfterNormalization(t *testing.T) {
	email := strings.Repeat("a", 64) + "@" + strings.Repeat("b", 63) + "." + strings.Repeat("c", 63) + "." + strings.Repeat("d", 61)
	if value, err := emailAddress(" " + strings.ToUpper(email) + " "); err != nil || value != email {
		t.Fatalf("254 字节邮箱未被正常规范化: %v", err)
	}
	for _, value := range []string{email + "x", strings.Repeat("é", 122) + "@example.com"} {
		if _, err := emailAddress(value); err == nil || !strings.Contains(err.Error(), "254") {
			t.Errorf("邮箱字节上限未生效: %v", err)
		}
	}
}
