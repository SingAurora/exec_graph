package graphguide

import "testing"

func TestForMode(t *testing.T) {
	raw := `{"action":"记录火候","expression":"保留判断","agreement":"记录用时"}`
	for mode, want := range map[string]string{"action": "记录火候", "expression": "保留判断", "agreement": "记录用时"} {
		if got := ForMode(raw, mode); got != want {
			t.Fatalf("%s: %q", mode, got)
		}
	}
	if got := ForMode("旧版指引", "expression"); got != "" {
		t.Fatalf("旧版指引不应注入表达: %q", got)
	}
}
