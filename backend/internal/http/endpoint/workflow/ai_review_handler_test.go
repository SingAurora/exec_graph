package workflow

import (
	"errors"
	"testing"
)

func TestExtractAIMessageContentMarksReasoningOnlyResponseForRecovery(t *testing.T) {
	body := []byte(`{"choices":[{"message":{"content":null,"reasoning_content":"先逐条检查证据"},"finish_reason":"stop"}]}`)
	_, err := extractAIMessageContent("deepseek", body)
	var reasoningOnly reasoningOnlyResponseError
	if !errors.As(err, &reasoningOnly) {
		t.Fatalf("expected reasoning-only response error, got %v", err)
	}
	if reasoningOnly.Reasoning != "先逐条检查证据" {
		t.Fatalf("unexpected reasoning: %q", reasoningOnly.Reasoning)
	}
}
