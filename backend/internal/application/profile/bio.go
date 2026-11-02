package profile

import (
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
)

// NormalizeBio 去除简介首尾空白并限制 Unicode 码点数；512 个码点最多约 2 KB，远小于 TEXT 的 65 KB。
func NormalizeBio(value string) (string, error) {
	bio := strings.TrimSpace(value)
	if utf8.RuneCountInString(bio) > constants.BiographyLimit {
		return "", fault.New(fault.Invalid, "个人简介最多 "+strconv.Itoa(constants.BiographyLimit)+" 个字符")
	}
	return bio, nil
}
