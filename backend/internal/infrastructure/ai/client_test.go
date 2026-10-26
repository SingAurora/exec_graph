package ai

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	app "github.com/singaurora/exec-graph/backend/internal/application/generation"
	"github.com/singaurora/exec-graph/backend/internal/bootstrap/config"
	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
)

func TestPlatformCompletionValidation(t *testing.T) {
	for _, test := range []struct {
		name, body string
		status     int
		valid      bool
	}{
		{"success", `{"choices":[{"message":{"content":"{}"},"finish_reason":"stop"}],"usage":{"prompt_tokens":12,"completion_tokens":6}}`, 200, true},
		{"upstream", `private upstream diagnostic`, 503, false},
		{"truncated", `{"choices":[{"message":{"content":"partial"},"finish_reason":"length"}]}`, 200, false},
		{"empty", `{"choices":[]}`, 200, false},
		{"invalid", `<html>bad gateway</html>`, 200, false},
		{"large", strings.Repeat("a", constants.MaxJSONBytes+1), 200, false},
	} {
		t.Run(test.name, func(t *testing.T) {
			server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path != "/chat/completions" || r.Header.Get("Authorization") != "Bearer test-only" {
					t.Error("平台路径或认证未装配")
				}
				var input completionRequest
				if err := json.NewDecoder(r.Body).Decode(&input); err != nil || input.ResponseFormat.Type != "json_object" || input.Model != "test-model" || input.Thinking.Type != "disabled" || input.MaxTokens != constants.AIOutputTokens {
					t.Error("生成配置未传递")
				}
				w.WriteHeader(test.status)
				_, _ = w.Write([]byte(test.body))
			}))
			defer server.Close()
			client, err := New(config.AI{BaseURL: server.URL, APIKey: "test-only", Model: "test-model"})
			if err != nil {
				t.Fatal(err)
			}
			client.http = server.Client()
			out, err := client.Complete(context.Background(), []app.Message{{Role: "user", Content: "事实"}})
			if test.valid {
				if err != nil || out.Content != "{}" || out.InputTokens != 12 || out.OutputTokens != 6 {
					t.Fatalf("结果或用量不正确: %+v %v", out, err)
				}
			} else if err == nil || strings.Contains(err.Error(), "private upstream") || strings.Contains(err.Error(), "test-only") {
				t.Fatalf("失败被接受或泄露上游正文: %v", err)
			}
		})
	}
}
