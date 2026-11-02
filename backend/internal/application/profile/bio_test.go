package profile

import (
	"strings"
	"testing"

	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
)

func TestBiographyNormalization(t *testing.T) {
	allowed := strings.Repeat("😀", constants.BiographyLimit)
	if actual, err := NormalizeBio("  " + allowed + "  "); err != nil || actual != allowed {
		t.Fatalf("简介码点计数或首尾空白处理错误: %v", err)
	}
	if _, err := NormalizeBio(strings.Repeat("😀", constants.BiographyLimit+1)); err == nil {
		t.Fatal("超长简介被接受")
	}
}
