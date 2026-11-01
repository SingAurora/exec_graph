// Package aimodel 解析生成记录中保存的模型标识，供公开 DTO 展示实际使用的模型名。
package aimodel

import "strings"

// ResponseModel 返回本轮实际生成 AI 回复的模型名。
// 记录格式为 "draft=<行动模型>;analysis=<分析模型>"；无法识别时返回空字符串，由调用方回退到通用名称。
func ResponseModel(mode, stored string) string {
	target := "draft"
	if mode == "expression" || mode == "agreement" {
		target = "analysis"
	}
	for _, part := range strings.Split(stored, ";") {
		name, value, ok := strings.Cut(strings.TrimSpace(part), "=")
		if ok && strings.TrimSpace(name) == target {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
