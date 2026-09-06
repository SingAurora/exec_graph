package app

import (
	"context"
	"testing"
)

func TestNormalizeAIKeyRequestRestrictsProviders(t *testing.T) {
	tests := []struct {
		name      string
		provider  string
		wantError bool
	}{
		{name: "deepseek", provider: aiProviderDeepSeek},
		{name: "openai", provider: aiProviderOpenAI},
		{name: "doubao", provider: aiProviderDoubao},
		{name: "claude", provider: aiProviderClaude},
		{name: "legacy openai compatible maps to openai", provider: "openai_compatible"},
		{name: "unsupported", provider: "gemini", wantError: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			provider, label, apiKey, baseURL, model, err := normalizeAIKeyRequest(createAIKeyRequest{
				Provider: tt.provider,
				APIKey:   "sk-test-key",
				Model:    "test-model",
			})
			if tt.wantError {
				if err == nil {
					t.Fatalf("expected error")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if provider == "openai_compatible" {
				t.Fatalf("legacy provider should not be stored")
			}
			if label == "" || apiKey == "" || baseURL == "" || model == "" {
				t.Fatalf("expected normalized fields, got label=%q apiKey=%q baseURL=%q model=%q", label, apiKey, baseURL, model)
			}
		})
	}
}

func TestNormalizeAIKeyRequestRequiresModel(t *testing.T) {
	_, _, _, _, _, err := normalizeAIKeyRequest(createAIKeyRequest{
		Provider: aiProviderDeepSeek,
		APIKey:   "sk-test-key",
	})
	if err == nil {
		t.Fatalf("expected missing model error")
	}
}

func TestNewAIProbeRequestUsesProviderAuthStyle(t *testing.T) {
	claudeRequest, err := newAIProbeRequest(context.Background(), aiProviderClaude, "claude-key", "https://api.anthropic.com/v1", "claude-test-model")
	if err != nil {
		t.Fatalf("claude request: %v", err)
	}
	if claudeRequest.Method != "POST" || claudeRequest.URL.Path != "/v1/messages" {
		t.Fatalf("expected Claude messages request, got %s %s", claudeRequest.Method, claudeRequest.URL.Path)
	}
	if claudeRequest.Header.Get("x-api-key") != "claude-key" {
		t.Fatalf("expected Claude x-api-key header")
	}
	if claudeRequest.Header.Get("anthropic-version") == "" {
		t.Fatalf("expected Claude version header")
	}
	if claudeRequest.Header.Get("Authorization") != "" {
		t.Fatalf("Claude request should not use bearer authorization")
	}

	openAIRequest, err := newAIProbeRequest(context.Background(), aiProviderOpenAI, "openai-key", "https://api.openai.com/v1", "gpt-test-model")
	if err != nil {
		t.Fatalf("openai request: %v", err)
	}
	if openAIRequest.Method != "POST" || openAIRequest.URL.Path != "/v1/chat/completions" {
		t.Fatalf("expected OpenAI chat completion request, got %s %s", openAIRequest.Method, openAIRequest.URL.Path)
	}
	if openAIRequest.Header.Get("Authorization") != "Bearer openai-key" {
		t.Fatalf("expected bearer authorization")
	}
}
