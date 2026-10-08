package review

import (
	"strings"
	"testing"
)

func TestQuickActionPromptsUseQualityFocus(t *testing.T) {
	request := CompletionRequest{SmartContract: SmartContract{ID: "smart-contract-quick-action"}}
	system, _, err := completionPrompt(request)
	if err != nil {
		t.Fatalf("completionPrompt() error = %v", err)
	}
	assertQualityPrompt(t, system)

	draftSystem, _, err := draftPrompt(DraftRequest{SmartContract: SmartContract{ID: "smart-contract-quick-action"}})
	if err != nil {
		t.Fatalf("draftPrompt() error = %v", err)
	}
	assertQualityPrompt(t, draftSystem)

	finalSystem, _, err := finalizationPrompt(request, "已有行动记录")
	if err != nil {
		t.Fatalf("finalizationPrompt() error = %v", err)
	}
	assertQualityPrompt(t, finalSystem)
}

func assertQualityPrompt(t *testing.T, prompt string) {
	t.Helper()
	for _, expected := range []string{"行动质量指南", "核心效果", "关键质量或风险", "收尾状态"} {
		if !strings.Contains(prompt, expected) {
			t.Errorf("prompt does not contain %q: %s", expected, prompt)
		}
	}
	for _, forbidden := range []string{"重点行动指南", "方向、质量和反馈"} {
		if strings.Contains(prompt, forbidden) {
			t.Errorf("prompt contains obsolete phrase %q: %s", forbidden, prompt)
		}
	}
}
