package generation

import (
	"strings"
	"testing"

	"github.com/singaurora/exec-graph/backend/internal/application/action"
)

const (
	testAssetOne = "11111111-1111-4111-8111-111111111111"
	testAssetTwo = "22222222-2222-4222-8222-222222222222"
)

func TestApplyImagesPlacesUsedImagesAndExplainsInvalidOnes(t *testing.T) {
	draft := Draft{
		Reply:     "已整理",
		Objective: "先准备材料。\n\n{{image:1}}\n\n最后装盘。",
		InvalidImages: []ImageIssue{
			{Ref: "image:2", Reason: "备注没有说明图片内容"},
		},
	}
	images := []action.ImageInput{{AssetID: testAssetOne, Alt: "成品装盘"}, {AssetID: testAssetTwo, Alt: "图片"}}
	if err := applyImages(&draft, images); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(draft.Objective, "![成品装盘](asset:"+testAssetOne+")") {
		t.Fatalf("图片没有放入正文: %s", draft.Objective)
	}
	if len(draft.Images) != 1 || draft.Images[0].AssetID != testAssetOne {
		t.Fatalf("使用图片列表不正确: %+v", draft.Images)
	}
	if len(draft.InvalidImages) != 1 || !strings.Contains(draft.Reply, "未放入正文的图片") {
		t.Fatalf("无效图片没有说明: %+v %s", draft.InvalidImages, draft.Reply)
	}
}

func TestApplyImagesTreatsUnmentionedImagesAsInvalid(t *testing.T) {
	draft := Draft{Reply: "已整理", Objective: "只有文字。"}
	images := []action.ImageInput{{AssetID: testAssetOne, Alt: "成品装盘"}}
	if err := applyImages(&draft, images); err != nil {
		t.Fatal(err)
	}
	if len(draft.Images) != 0 || len(draft.InvalidImages) != 1 || draft.InvalidImages[0].Ref != "image:1" {
		t.Fatalf("漏放的图片没有转为无效说明: %+v", draft)
	}
	if !strings.Contains(draft.Reply, "未放入正文的图片") {
		t.Fatalf("回复没有说明漏放图片: %s", draft.Reply)
	}
}

func TestApplyImagesRejectsInvalidPlacement(t *testing.T) {
	images := []action.ImageInput{{AssetID: testAssetOne, Alt: "成品装盘"}, {AssetID: testAssetTwo, Alt: "过程"}}
	for _, test := range []struct {
		name  string
		draft Draft
	}{
		{"unknown ref", Draft{Reply: "已整理", Objective: "{{image:3}}"}},
		{"duplicate ref", Draft{Reply: "已整理", Objective: "{{image:1}}\n\n{{image:1}}"}},
		{"external image", Draft{Reply: "已整理", Objective: "![外部](https://example.com/a.jpg)"}},
		{"used and invalid", Draft{Reply: "已整理", Objective: "{{image:1}}", InvalidImages: []ImageIssue{{Ref: "image:1", Reason: "不清楚"}}}},
		{"empty reason", Draft{Reply: "已整理", Objective: "文字", InvalidImages: []ImageIssue{{Ref: "image:2", Reason: " "}}}},
	} {
		t.Run(test.name, func(t *testing.T) {
			if err := applyImages(&test.draft, images); err == nil {
				t.Fatal("无效图片位置被接受")
			}
		})
	}
}

func TestImagesFromMarkdownRestoresOrderAndNotes(t *testing.T) {
	markdown := "开头\n\n![成品装盘](asset:" + testAssetOne + ")\n\n![过程](asset:" + testAssetTwo + ")"
	images := ImagesFromMarkdown(markdown)
	if len(images) != 2 || images[0].AssetID != testAssetOne || images[0].Alt != "成品装盘" || images[1].AssetID != testAssetTwo {
		t.Fatalf("图片还原不正确: %+v", images)
	}
}

func TestSnapshotIncludesImageReferencesForPrompt(t *testing.T) {
	pending := Pending{Mode: "action", ActorID: "actor", Images: []action.ImageInput{{AssetID: testAssetOne, Alt: "成品装盘"}}}
	snapshot := snapshotFor(action.Graph{}, nil, nil, pending, false)
	if len(snapshot.Images) != 1 || snapshot.Images[0].Ref != "image:1" || snapshot.Images[0].Alt != "成品装盘" {
		t.Fatalf("快照图片不正确: %+v", snapshot.Images)
	}
	messages, err := prompt(snapshot, pending)
	if err != nil || len(messages) == 0 || !strings.Contains(messages[0].Content, "成品装盘") {
		t.Fatalf("图片备注没有进入提示词: %+v %v", messages, err)
	}
}
