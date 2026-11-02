package generation

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/singaurora/exec-graph/backend/internal/application/action"
	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
)

var (
	imageTokenPattern = regexp.MustCompile(`\{\{image:(\d+)\}\}`)
	assetImagePattern = regexp.MustCompile(`!\[((?:\\.|[^\]])*)\]\(asset:([0-9a-fA-F-]{36})\)`)
)

// applyImages 校验图片占位符、替换为站内 asset 地址，并记录无效图片。
func applyImages(draft *Draft, images []action.ImageInput) error {
	if strings.Contains(draft.Objective, "![") {
		return fault.New(fault.Invalid, "图片请使用 {{image:N}} 占位符")
	}
	if len(images) == 0 {
		if imageTokenPattern.MatchString(draft.Objective) || len(draft.InvalidImages) != 0 {
			return fault.New(fault.Invalid, "没有本轮图片，不能引用图片")
		}
		return nil
	}
	locs := imageTokenPattern.FindAllStringSubmatchIndex(draft.Objective, -1)
	used := make([]bool, len(images))
	var body strings.Builder
	last := 0
	for _, loc := range locs {
		body.WriteString(draft.Objective[last:loc[0]])
		number, err := strconv.Atoi(draft.Objective[loc[2]:loc[3]])
		if err != nil || number < 1 || number > len(images) || used[number-1] {
			return fault.New(fault.Invalid, "图片来源或位置不合法")
		}
		used[number-1] = true
		image := images[number-1]
		body.WriteString("![" + escapeImageAlt(image.Alt) + "](asset:" + strings.ToLower(image.AssetID) + ")")
		last = loc[1]
	}
	body.WriteString(draft.Objective[last:])

	invalidSeen := make([]bool, len(images))
	for i := range draft.InvalidImages {
		issue := &draft.InvalidImages[i]
		number, err := parseImageRef(issue.Ref)
		if err != nil || number < 1 || number > len(images) || used[number-1] || invalidSeen[number-1] {
			return fault.New(fault.Invalid, "无效图片说明不合法")
		}
		issue.Ref = "image:" + strconv.Itoa(number)
		issue.Reason = strings.TrimSpace(issue.Reason)
		if issue.Reason == "" || utf8.RuneCountInString(issue.Reason) > constants.ImageIssueReasonLimit {
			return fault.New(fault.Invalid, "无效图片必须说明原因")
		}
		invalidSeen[number-1] = true
	}
	for i := range images {
		if used[i] || invalidSeen[i] {
			continue
		}
		draft.InvalidImages = append(draft.InvalidImages, ImageIssue{Ref: "image:" + strconv.Itoa(i+1), Reason: "未放入正文"})
		invalidSeen[i] = true
	}

	usedImages := make([]action.ImageInput, 0, len(images))
	for i := range images {
		if used[i] {
			usedImages = append(usedImages, images[i])
		}
	}
	draft.Images = usedImages
	draft.Objective = body.String()
	if strings.Contains(draft.Objective, "{{image:") {
		return fault.New(fault.Invalid, "图片占位符格式不正确")
	}
	if utf8.RuneCountInString(draft.Objective) > constants.ActionContentLimit {
		return fault.New(fault.Invalid, "行动正文超过"+strconv.Itoa(constants.ActionContentLimit)+"字，请精简或拆成多个行动后重试")
	}
	if len(draft.InvalidImages) > 0 {
		lines := make([]string, 0, len(draft.InvalidImages))
		for _, issue := range draft.InvalidImages {
			lines = append(lines, "图片 "+strings.TrimPrefix(issue.Ref, "image:")+"："+issue.Reason)
		}
		draft.Reply = strings.TrimSpace(draft.Reply) + "\n\n未放入正文的图片：\n- " + strings.Join(lines, "\n- ")
	}
	return nil
}

func parseImageRef(ref string) (int, error) {
	value := strings.TrimPrefix(strings.TrimSpace(ref), "image:")
	number, err := strconv.Atoi(value)
	if err != nil || !strings.HasPrefix(strings.TrimSpace(ref), "image:") {
		return 0, fmt.Errorf("图片标识不合法")
	}
	return number, nil
}

func escapeImageAlt(value string) string {
	value = strings.ReplaceAll(value, `\`, `\\`)
	return strings.ReplaceAll(value, `]`, `\]`)
}

func unescapeImageAlt(value string) string {
	value = strings.ReplaceAll(value, `\]`, `]`)
	return strings.ReplaceAll(value, `\\`, `\`)
}

// ImagesFromMarkdown 从已归一化的正文还原图片顺序和备注，供生成结果读取使用。
func ImagesFromMarkdown(markdown string) []action.ImageInput {
	matches := assetImagePattern.FindAllStringSubmatch(markdown, -1)
	images := make([]action.ImageInput, 0, len(matches))
	for _, match := range matches {
		images = append(images, action.ImageInput{AssetID: strings.ToLower(match[2]), Alt: unescapeImageAlt(match[1])})
	}
	return images
}
