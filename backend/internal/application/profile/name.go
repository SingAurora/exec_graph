package profile

import (
	"strings"
	"unicode/utf8"

	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
	"github.com/singaurora/exec-graph/backend/internal/shared/textinput"
)

// NormalizeName 为注册及资料编辑统一检查昵称，并去除首尾空白。
func NormalizeName(value string) (string, error) {
	name := strings.TrimSpace(value)
	if name == "" {
		return "", fault.New(fault.Invalid, "请输入昵称")
	}
	if !utf8.ValidString(value) || textinput.HasUnsafeCharacters(value) {
		return "", fault.New(fault.Invalid, "昵称不能包含换行、控制字符或不可见格式字符")
	}
	if utf8.RuneCountInString(name) > constants.ProfileNameLimit {
		return "", fault.New(fault.Invalid, "昵称最多 30 个字符")
	}
	return name, nil
}
