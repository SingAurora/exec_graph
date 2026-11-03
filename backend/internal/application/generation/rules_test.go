package generation

import (
	"strings"
	"testing"
	"unicode/utf8"
)

func TestGenerationRulesSelectOnlyCurrentMode(t *testing.T) {
	action := generationRulesFor("action")
	if !strings.Contains(action, "invalidImages") || !strings.Contains(action, "title 不超过 30") {
		t.Fatal("行动规则缺少行动字段或图片约束")
	}
	expression := generationRulesFor("expression")
	if strings.Contains(expression, "invalidImages") || !strings.Contains(expression, "只修改当前表达") {
		t.Fatal("表达规则混入了行动专属内容或缺少表达任务")
	}
	agreement := generationRulesFor("agreement")
	if strings.Contains(agreement, "图片") || !strings.Contains(agreement, "向后传递的约定") {
		t.Fatal("约定规则混入了行动专属内容或缺少约定任务")
	}
}

func TestVerificationRulesSelectOnlyCurrentMode(t *testing.T) {
	action := verificationRulesFor("action")
	if !strings.Contains(action, "reviews 只对应 context.sources") || !strings.Contains(action, "action 模式") {
		t.Fatal("行动核验缺少来源核对规则")
	}
	expression := verificationRulesFor("expression")
	if strings.Contains(expression, "reviews 只对应 context.sources") || !strings.Contains(expression, "expression 模式") {
		t.Fatal("表达核验混入了来源核对规则或缺少表达核验")
	}
	agreement := verificationRulesFor("agreement")
	if strings.Contains(agreement, "reviews 只对应 context.sources") || !strings.Contains(agreement, "agreement 模式") {
		t.Fatal("约定核验混入了来源核对规则或缺少约定核验")
	}
}

func TestPromptRulesStayCompact(t *testing.T) {
	limits := map[string]int{
		"generation:action":       1600,
		"generation:expression":   1300,
		"generation:agreement":    1100,
		"verification:action":     2200,
		"verification:expression": 1500,
		"verification:agreement":  1200,
	}
	for name, limit := range limits {
		var text string
		switch name {
		case "generation:action":
			text = generationRulesFor("action")
		case "generation:expression":
			text = generationRulesFor("expression")
		case "generation:agreement":
			text = generationRulesFor("agreement")
		case "verification:action":
			text = verificationRulesFor("action")
		case "verification:expression":
			text = verificationRulesFor("expression")
		case "verification:agreement":
			text = verificationRulesFor("agreement")
		}
		if count := utf8.RuneCountInString(text); count > limit {
			t.Fatalf("%s 提示词过长: %d > %d", name, count, limit)
		}
	}
}
