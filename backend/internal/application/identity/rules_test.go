package identity

import "testing"

func TestNormalizeEmail(t *testing.T) {
	tests := []struct {
		name    string
		value   string
		want    string
		wantErr bool
	}{
		{name: "trim and lowercase", value: "  User@Example.COM ", want: "user@example.com"},
		{name: "display name is rejected", value: "User <user@example.com>", wantErr: true},
		{name: "invalid address", value: "not-an-email", wantErr: true},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, err := NormalizeEmail(test.value)
			if test.wantErr {
				if err == nil {
					t.Fatalf("expected an error for %q", test.value)
				}
				return
			}
			if err != nil {
				t.Fatalf("NormalizeEmail(%q): %v", test.value, err)
			}
			if got != test.want {
				t.Fatalf("NormalizeEmail(%q) = %q, want %q", test.value, got, test.want)
			}
		})
	}
}
