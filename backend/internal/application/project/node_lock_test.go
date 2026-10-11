package project

import "testing"

func TestReviewUUID(t *testing.T) {
	for _, test := range []struct {
		name   string
		review map[string]any
		want   string
	}{
		{name: "current response", review: map[string]any{"uuid": "new-review"}, want: "new-review"},
		{name: "legacy response", review: map[string]any{"id": "old-review"}, want: "old-review"},
		{name: "current field takes precedence", review: map[string]any{"uuid": "new-review", "id": "old-review"}, want: "new-review"},
		{name: "missing review identifier", review: map[string]any{}, want: ""},
	} {
		t.Run(test.name, func(t *testing.T) {
			if got := reviewUUID(test.review); got != test.want {
				t.Fatalf("reviewUUID() = %q, want %q", got, test.want)
			}
		})
	}
}
