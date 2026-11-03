package generation

import (
	"strings"
	"testing"
)

func TestDefaultPromptsSeparateOutputContractFromRequirements(t *testing.T) {
	defaults := DefaultPrompts()
	if !strings.Contains(defaults.Contract, `"title"`) || !strings.Contains(defaults.Contract, `"expression"`) {
		t.Fatal("平台输出契约缺少 JSON 字段")
	}
	for name, value := range map[string]string{"行动": defaults.Action, "表达": defaults.Expression, "约定": defaults.Agreement} {
		if strings.TrimSpace(value) == "" {
			t.Fatalf("%s默认要求为空", name)
		}
		if strings.Contains(strings.ToLower(value), "json") {
			t.Fatalf("%s默认要求混入了 JSON 输出说明", name)
		}
	}
}
