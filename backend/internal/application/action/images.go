package action

import (
	"regexp"
	"strings"

	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
)

var assetReferencePattern = regexp.MustCompile(`\(asset:([0-9a-fA-F-]{36})\)`)

// validateGenerationImages 保证发布时提交的图片与生成正文中的图片引用完全一致。
func validateGenerationImages(markdown string, images []ImageInput) error {
	matches := assetReferencePattern.FindAllStringSubmatch(markdown, -1)
	if len(matches) != len(images) {
		return fault.New(fault.Conflict, "配图与生成正文不一致，请重新整理")
	}
	for i, match := range matches {
		if !strings.EqualFold(match[1], images[i].AssetID) {
			return fault.New(fault.Conflict, "配图与生成正文不一致，请重新整理")
		}
	}
	return nil
}
