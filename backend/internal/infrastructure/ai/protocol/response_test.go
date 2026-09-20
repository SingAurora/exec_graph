package protocol

import (
	"errors"
	"testing"
)

func TestExtractMessageContentMarksReasoningOnlyResponseForRecovery(t *testing.T) {
	body := []byte(`{"choices":[{"message":{"content":null,"reasoning_content":"先逐条检查证据"},"finish_reason":"stop"}]}`)
	_, err := ExtractMessageContent("openai", body)
	var reasoningOnly ReasoningOnlyResponseError
	if !errors.As(err, &reasoningOnly) {
		t.Fatalf("expected reasoning-only response error, got %v", err)
	}
	if reasoningOnly.Reasoning != "先逐条检查证据" {
		t.Fatalf("unexpected reasoning: %q", reasoningOnly.Reasoning)
	}
}
