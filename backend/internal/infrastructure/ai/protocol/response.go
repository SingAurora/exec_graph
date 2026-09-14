package protocol

import (
	"encoding/json"
	"fmt"
	"strings"
)

type ReasoningOnlyResponseError struct {
	Reasoning string
}

func (err ReasoningOnlyResponseError) Error() string {
	return "AI 只返回了推理过程，未生成最终审查结论"
}

// ExtractMessageContent converts supported provider response shapes into text.
// Callers provide the provider's authentication style so this package stays
// independent from account and key-management rules.
func ExtractMessageContent(authStyle string, body []byte) (string, error) {
	if authStyle == "anthropic" {
		var decoded struct {
			Content []struct {
				Text string `json:"text"`
			} `json:"content"`
		}
		if err := json.Unmarshal(body, &decoded); err != nil {
			return "", fmt.Errorf("AI 审查结果格式不正确")
		}
		for _, item := range decoded.Content {
			if strings.TrimSpace(item.Text) != "" {
				return item.Text, nil
			}
		}
		return "", fmt.Errorf("AI 审查没有返回文本")
	}

	var decoded struct {
		Choices []struct {
			Message struct {
				Content          json.RawMessage `json:"content"`
				ReasoningContent string          `json:"reasoning_content"`
				Refusal          string          `json:"refusal"`
			} `json:"message"`
			FinishReason string `json:"finish_reason"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(body, &decoded); err != nil {
		return "", fmt.Errorf("AI 审查结果格式不正确")
	}
	if len(decoded.Choices) == 0 {
		return "", fmt.Errorf("AI 审查没有返回候选结果")
	}
	choice := decoded.Choices[0]
	if content := extractOpenAIContent(choice.Message.Content); content != "" {
		return content, nil
	}
	if refusal := strings.TrimSpace(choice.Message.Refusal); refusal != "" {
		return "", fmt.Errorf("AI 拒绝生成审查结论：%s", refusal)
	}
	if reasoning := strings.TrimSpace(choice.Message.ReasoningContent); reasoning != "" {
		return "", ReasoningOnlyResponseError{Reasoning: reasoning}
	}
	if choice.FinishReason == "length" {
		return "", fmt.Errorf("AI 在生成最终审查结论前达到输出上限，请重试或改用输出更直接的模型")
	}
	return "", fmt.Errorf("AI 审查没有返回最终结论")
}

func ExtractJSONObject(value string) string {
	trimmed := strings.TrimSpace(value)
	trimmed = strings.TrimPrefix(trimmed, "```json")
	trimmed = strings.TrimPrefix(trimmed, "```")
	trimmed = strings.TrimSuffix(trimmed, "```")
	trimmed = strings.TrimSpace(trimmed)
	start := strings.Index(trimmed, "{")
	end := strings.LastIndex(trimmed, "}")
	if start >= 0 && end > start {
		return trimmed[start : end+1]
	}
	return trimmed
}

func extractOpenAIContent(raw json.RawMessage) string {
	if len(raw) == 0 || string(raw) == "null" {
		return ""
	}
	var text string
	if err := json.Unmarshal(raw, &text); err == nil {
		return strings.TrimSpace(text)
	}
	var parts []struct {
		Text string `json:"text"`
	}
	if err := json.Unmarshal(raw, &parts); err != nil {
		return ""
	}
	values := make([]string, 0, len(parts))
	for _, part := range parts {
		if text := strings.TrimSpace(part.Text); text != "" {
			values = append(values, text)
		}
	}
	return strings.Join(values, "\n")
}
