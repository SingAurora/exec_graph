// Package graphguide 读取图设置中的三份核验要求，不依赖具体业务层。
package graphguide

import (
	"encoding/json"
	"strings"
)

type guidance struct {
	Action     string `json:"action"`
	Expression string `json:"expression"`
	Agreement  string `json:"agreement"`
}

// ForMode 返回当前模式实际使用的要求；旧版单段文本只作为行动要求。
func ForMode(raw, mode string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	var value guidance
	if err := json.Unmarshal([]byte(raw), &value); err != nil {
		if mode == "action" {
			return raw
		}
		return ""
	}
	switch mode {
	case "expression":
		return strings.TrimSpace(value.Expression)
	case "agreement":
		return strings.TrimSpace(value.Agreement)
	default:
		return strings.TrimSpace(value.Action)
	}
}
