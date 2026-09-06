package app

import (
	"net/http/httptest"
	"testing"
)

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
			got, err := normalizeEmail(test.value)
			if test.wantErr {
				if err == nil {
					t.Fatalf("expected an error for %q", test.value)
				}
				return
			}
			if err != nil {
				t.Fatalf("normalizeEmail(%q): %v", test.value, err)
			}
			if got != test.want {
				t.Fatalf("normalizeEmail(%q) = %q, want %q", test.value, got, test.want)
			}
		})
	}
}

func TestBearerToken(t *testing.T) {
	request := httptest.NewRequest("GET", "/", nil)
	request.Header.Set("Authorization", "Bearer token-value")
	if got := bearerToken(request); got != "token-value" {
		t.Fatalf("bearerToken() = %q, want token-value", got)
	}
	request.Header.Set("Authorization", "Basic token-value")
	if got := bearerToken(request); got != "" {
		t.Fatalf("bearerToken() accepted a non-Bearer scheme: %q", got)
	}
}

func TestNewOpaqueID(t *testing.T) {
	first, err := newOpaqueID("project")
	if err != nil {
		t.Fatalf("newOpaqueID(): %v", err)
	}
	second, err := newOpaqueID("project")
	if err != nil {
		t.Fatalf("newOpaqueID(): %v", err)
	}
	if first == second {
		t.Fatalf("newOpaqueID() returned duplicate IDs: %q", first)
	}
	if len(first) != len("project-")+32 {
		t.Fatalf("newOpaqueID() length = %d, want %d", len(first), len("project-")+32)
	}
}

func TestAvatarExtension(t *testing.T) {
	tests := []struct {
		contentType string
		want        string
		valid       bool
	}{
		{contentType: "image/jpeg", want: ".jpg", valid: true},
		{contentType: "image/png", want: ".png", valid: true},
		{contentType: "image/webp", want: ".webp", valid: true},
		{contentType: "image/gif", valid: false},
		{contentType: "application/octet-stream", valid: false},
	}
	for _, test := range tests {
		got, valid := avatarExtension(test.contentType)
		if valid != test.valid || got != test.want {
			t.Fatalf("avatarExtension(%q) = (%q, %t), want (%q, %t)", test.contentType, got, valid, test.want, test.valid)
		}
	}
}
