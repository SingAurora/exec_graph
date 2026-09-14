package app

import "testing"

func TestDecodeConversationJSONAcceptsFencedAndQuotedJSON(t *testing.T) {
	type output struct {
		Reply string `json:"reply"`
	}

	for _, raw := range []string{
		"```json\n{\"reply\":\"已更新草案\"}\n```",
		"\"{\\\"reply\\\":\\\"已更新草案\\\"}\"",
	} {
		var result output
		if err := decodeConversationJSON(raw, &result); err != nil {
			t.Fatalf("decode %q: %v", raw, err)
		}
		if result.Reply != "已更新草案" {
			t.Fatalf("unexpected reply: %q", result.Reply)
		}
	}
}
