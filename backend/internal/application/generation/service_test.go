package generation

import (
	"strings"
	"testing"

	"github.com/singaurora/exec-graph/backend/internal/application/action"
	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
)

func TestValidInputMessagesLimitsEachMessage(t *testing.T) {
	limit := strings.Repeat("字", constants.AIUserMessageLimit)
	if !validInputMessages(GenerateInput{Mode: "action", Messages: []string{limit}}) {
		t.Fatal("恰好达到单条上限的输入被拒绝")
	}
	if validInputMessages(GenerateInput{Mode: "action", Messages: []string{limit + "多"}}) {
		t.Fatal("超过单条上限的输入被接受")
	}
	if !validInputMessages(GenerateInput{Mode: "action", Messages: []string{limit, limit}}) {
		t.Fatal("多条消息合计未超过总上限时不应被单条限制误伤")
	}
}

func TestValidInputImagesRequiresNotesAndUniqueAssets(t *testing.T) {
	valid := GenerateInput{Mode: "action", Messages: []string{"行动"}, Images: []action.ImageInput{{AssetID: "11111111-1111-4111-8111-111111111111", Alt: "成品"}}}
	if !validInputImages(valid) {
		t.Fatal("有效图片被拒绝")
	}
	for _, image := range []action.ImageInput{
		{AssetID: "11111111-1111-4111-8111-111111111111", Alt: " "},
		{AssetID: "not-a-uuid", Alt: "成品"},
		{AssetID: "11111111-1111-4111-8111-111111111111", Alt: strings.Repeat("字", constants.ImageAltLimit+1)},
	} {
		if validInputImages(GenerateInput{Images: []action.ImageInput{image}}) {
			t.Fatalf("无效图片被接受: %+v", image)
		}
	}
	duplicate := GenerateInput{Images: []action.ImageInput{
		{AssetID: "11111111-1111-4111-8111-111111111111", Alt: "成品"},
		{AssetID: "11111111-1111-4111-8111-111111111111", Alt: "过程"},
	}}
	if validInputImages(duplicate) {
		t.Fatal("重复图片被接受")
	}
}
