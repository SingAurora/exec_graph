// Package aigateway defines the application-facing AI generation port.
package aigateway

import (
	"context"
	"strings"
)

// ReasoningOnlyError 表示模型只返回了推理内容而没有最终答案。
type ReasoningOnlyError struct{ Reasoning string }

func (err ReasoningOnlyError) Error() string {
	return "AI 只返回了推理过程，未生成最终审查结论"
}

// Credential contains a decrypted provider credential for one outbound call.
// It is an internal value and must never be serialized into an HTTP response.
type Credential struct {
	Provider string
	APIKey   string
	BaseURL  string
	Model    string
}

// GenerateInput describes one structured text generation request.
type GenerateInput struct {
	Credential Credential
	System     string
	User       string
	MaxTokens  int
	JSONMode   bool
}

// Client generates model text without exposing provider-specific HTTP details.
type Client interface {
	GenerateContent(ctx context.Context, input GenerateInput) (string, error)
}

// ExtractJSONObject removes common Markdown wrappers and returns the outer JSON object.
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
