package account

import (
	"strings"
	"testing"
)

func TestNewPasswordRules(t *testing.T) {
	for _, password := range []string{"Ab!'\"\\;9", strings.Repeat("a", 16), "A1!simple-pass"} {
		if err := validateNewPassword(password); err != nil {
			t.Errorf("合法的英文、数字或符号密码被拒绝: %v", err)
		}
	}
	for _, password := range []string{"", "1234567", strings.Repeat("a", 33), "中文密码测试八位", strings.Repeat("😀", 8), string([]byte{0xff}) + "password"} {
		if err := validateNewPassword(password); err == nil {
			t.Error("非法长度或字符集的密码被接受")
		}
	}
	for _, character := range []rune{' ', '\t', '\n', '\u00a0', '\u3000', '\u2028', '\u0000', '\u007f'} {
		if err := validateNewPassword("pass" + string(character) + "word"); err == nil {
			t.Errorf("接受了空白或不可见字符 U+%04X", character)
		}
	}
}

func TestEmailLengthAfterNormalization(t *testing.T) {
	email := strings.Repeat("a", 36) + "@" + strings.Repeat("b", 10) + ".example.com"
	if value, err := emailAddress(" " + strings.ToUpper(email) + " "); err != nil || value != email {
		t.Fatalf("64 字节以内的邮箱未被正常规范化: %v", err)
	}
	for _, value := range []string{strings.Repeat("a", 53) + "@example.com", strings.Repeat("é", 27) + "@example.com"} {
		if _, err := emailAddress(value); err == nil || !strings.Contains(err.Error(), "64") {
			t.Errorf("邮箱字节上限未生效: %v", err)
		}
	}
}
