package generation

import (
	"strings"
	"testing"

	"github.com/singaurora/exec-graph/backend/internal/application/action"
)

func TestPlacementPromptAndParseOnlyChooseLineAnchors(t *testing.T) {
	current := "先准备材料。\n\n最后装盘。"
	images := []action.ImageInput{{AssetID: testAssetOne, Alt: "成品装盘"}, {AssetID: testAssetTwo, Alt: "图片"}}
	messages, err := placementPrompt(current, images)
	if err != nil || len(messages) != 2 || !strings.Contains(messages[1].Content, "成品装盘") || !strings.Contains(messages[1].Content, "image:1") || !strings.Contains(messages[1].Content, `"lines"`) {
		t.Fatalf("图片放置提示词不正确: %+v %v", messages, err)
	}
	content := `{"reply":"图片 1 已放入，图片 2 备注不清晰。","placements":[{"ref":"image:1","afterLine":1}],"invalidImages":[{"ref":"image:2","reason":"备注不清晰"}]}`
	draft, err := parsePlacement(content, current, images)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(draft.Objective, "![成品装盘](asset:"+testAssetOne+")") || len(draft.Images) != 1 {
		t.Fatalf("图片没有放入正文: %+v", draft)
	}
	if strings.Contains(draft.Objective, "图片备注也写进正文") || !strings.Contains(draft.Objective, "先准备材料。") || !strings.Contains(draft.Objective, "最后装盘。") {
		t.Fatalf("正文文字被改写: %s", draft.Objective)
	}
	if len(draft.InvalidImages) != 1 || !strings.Contains(draft.Reply, "未放入正文的图片") {
		t.Fatalf("无效图片没有说明: %+v %s", draft.InvalidImages, draft.Reply)
	}
}

func TestParsePlacementTreatsUnmentionedImagesAsInvalid(t *testing.T) {
	draft, err := parsePlacement(`{"reply":"已放置","placements":[],"invalidImages":[]}`, "先准备材料。\n\n最后装盘。", []action.ImageInput{{AssetID: testAssetOne, Alt: "成品装盘"}})
	if err != nil {
		t.Fatal(err)
	}
	if len(draft.Images) != 0 || len(draft.InvalidImages) != 1 || draft.InvalidImages[0].Ref != "image:1" || !strings.Contains(draft.Reply, "未放入正文的图片") {
		t.Fatalf("漏放图片没有转为无效说明: %+v", draft)
	}
}

func TestParsePlacementRejectsInvalidAnchorsAndRefs(t *testing.T) {
	images := []action.ImageInput{{AssetID: testAssetOne, Alt: "成品装盘"}, {AssetID: testAssetTwo, Alt: "过程"}}
	for _, content := range []string{
		`{"reply":"已放置","placements":[{"ref":"image:3","afterLine":1}],"invalidImages":[]}`,
		`{"reply":"已放置","placements":[{"ref":"image:1","afterLine":-1}],"invalidImages":[]}`,
		`{"reply":"已放置","placements":[{"ref":"image:1","afterLine":99}],"invalidImages":[]}`,
		`{"reply":"已放置","placements":[{"ref":"image:1","afterLine":1},{"ref":"image:1","afterLine":2}],"invalidImages":[]}`,
		`{"reply":"已放置","placements":[{"ref":"image:1","afterLine":1}],"invalidImages":[{"ref":"image:1","reason":"重复"}]}`,
		`{"reply":"已放置","placements":[],"invalidImages":[{"ref":"image:1","reason":" "}]}`,
	} {
		if _, err := parsePlacement(content, "正文\n第二行", images); err == nil {
			t.Fatalf("无效图片位置被接受: %s", content)
		}
	}
}
