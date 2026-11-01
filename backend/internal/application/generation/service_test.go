package generation

import (
	"strings"
	"testing"

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
