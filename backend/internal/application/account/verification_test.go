package account

import "testing"

func TestTargetLimitEmailForAuthenticatedChanges(t *testing.T) {
	tests := []struct {
		name    string
		purpose string
		target  string
		account string
		want    string
	}{
		{name: "change email uses current address", purpose: "change-email", target: "new@example.com", account: "old@example.com", want: "old@example.com"},
		{name: "another new address keeps the same account key", purpose: "change-email", target: "other@example.com", account: "old@example.com", want: "old@example.com"},
		{name: "change password uses current address", purpose: "change-password", target: "old@example.com", account: "old@example.com", want: "old@example.com"},
		{name: "registration still limits by target", purpose: "register", target: "new@example.com", account: "", want: "new@example.com"},
		{name: "reset still limits by target", purpose: "reset-password", target: "new@example.com", account: "", want: "new@example.com"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := targetLimitEmail(test.purpose, test.target, test.account); got != test.want {
				t.Fatalf("targetLimitEmail() = %q, want %q", got, test.want)
			}
		})
	}
}
