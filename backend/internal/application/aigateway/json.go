package aigateway

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
)

// GenerateJSON 请求一个结构化模型结果，并在模型忽略 JSON 模式时自动修复一次。
func GenerateJSON(ctx context.Context, client Client, input GenerateInput, target any) error {
	content, err := client.GenerateContent(ctx, input)
	if err != nil {
		return err
	}
	if decodeJSON(content, target) == nil {
		return nil
	}
	schema, err := json.Marshal(target)
	if err != nil {
		return fmt.Errorf("生成 AI 结果结构失败")
	}
	repairPayload, err := json.Marshal(struct {
		InvalidModelOutput string          `json:"invalidModelOutput"`
		RequiredJSONShape  json.RawMessage `json:"requiredJSONShape"`
	}{InvalidModelOutput: content, RequiredJSONShape: schema})
	if err != nil {
		return fmt.Errorf("生成 AI 结果修复请求失败")
	}
	input.System = "你是 JSON 输出修复器。将用户提供的模型输出转换为符合 requiredJSONShape 的 JSON 对象。保留原意；缺失字段使用空字符串、false 或空数组。只输出一个有效 JSON 对象，不要 Markdown、解释或代码围栏。"
	input.User = string(repairPayload)
	repaired, err := client.GenerateContent(ctx, input)
	if err != nil {
		return err
	}
	if err := decodeJSON(repaired, target); err != nil {
		return fmt.Errorf("AI 返回的结果不是可解析的 JSON；已尝试自动修复，请重试或更换模型")
	}
	return nil
}

func decodeJSON(content string, target any) error {
	var quoted string
	if err := json.Unmarshal([]byte(strings.TrimSpace(content)), &quoted); err == nil {
		if err := json.Unmarshal([]byte(ExtractJSONObject(quoted)), target); err == nil {
			return nil
		}
	}
	if err := json.Unmarshal([]byte(ExtractJSONObject(content)), target); err == nil {
		return nil
	}
	return fmt.Errorf("invalid JSON")
}
