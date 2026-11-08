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
	if !strings.Contains(action, "大部分篇幅") || !strings.Contains(action, "少量无法判断") {
		t.Fatal("行动规则缺少行动主线与边角内容容错")
	}
	expression := generationRulesFor("expression")
	if strings.Contains(expression, "invalidImages") || !strings.Contains(expression, "只修改当前表达") {
		t.Fatal("表达规则混入了行动专属内容或缺少表达任务")
	}
	if !strings.Contains(expression, "兴趣") || !strings.Contains(expression, "态度") {
		t.Fatal("表达规则没有面向他人的兴趣和态度要求")
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
		"generation:action":       1800,
		"generation:expression":   1400,
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

func TestDefaultEffectRulesAreLowBurden(t *testing.T) {
	expression := generationRulesFor("expression")
	if !strings.Contains(expression, "给我一个默认效果的表达") || !strings.Contains(expression, "2～4 句") || !strings.Contains(expression, "1～3 个支链行动") {
		t.Fatal("表达缺少默认效果触发或简短约束")
	}
	agreement := generationRulesFor("agreement")
	if !strings.Contains(agreement, "给我一个默认效果的约定") || !strings.Contains(agreement, "两句话") {
		t.Fatal("约定缺少默认效果触发或两句话约束")
	}
	action := generationRulesFor("action")
	if !strings.Contains(action, "对来源约定的回应") {
		t.Fatal("行动缺少来源约定逐条回应规则")
	}
}
