package generation

import (
	"strings"
	"testing"
)

func TestDefaultPromptsExposeGenerationTargetsAndVerificationRules(t *testing.T) {
	defaults := DefaultPrompts()
	if defaults.Contract == "" || defaults.Action == "" || defaults.Expression == "" || defaults.Agreement == "" {
		t.Fatal("默认提示词未完整返回")
	}
	for label, text := range map[string]string{
		"行动核验": defaults.VerificationAction,
		"表达核验": defaults.VerificationExpression,
		"约定核验": defaults.VerificationAgreement,
	} {
		if !strings.Contains(text, "依据核验") || !strings.Contains(text, "目标适配") {
			t.Fatalf("%s 规则缺少依据/目标分层: %q", label, text)
		}
	}
}
