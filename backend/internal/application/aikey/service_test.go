package aikey

import "testing"

func TestNormalizeRestrictsProviders(t *testing.T) {
	tests := []struct {
		name      string
		provider  string
		wantError bool
	}{
		{name: "deepseek", provider: "deepseek"},
		{name: "openai", provider: "openai"},
		{name: "doubao", provider: "doubao"},
		{name: "claude", provider: "claude"},
		{name: "legacy openai compatible maps to openai", provider: "openai_compatible"},
		{name: "unsupported", provider: "gemini", wantError: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			provider, label, apiKey, baseURL, model, err := normalize(tt.provider, "", "sk-test-key", "", "test-model")
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

func TestNormalizeRequiresModel(t *testing.T) {
	_, _, _, _, _, err := normalize("deepseek", "", "sk-test-key", "", "")
	if err == nil {
		t.Fatalf("expected missing model error")
	}
}
