package endpoint

import (
	"net/http/httptest"
	"testing"

	applicationidentity "github.com/singaurora/exec-graph/backend/internal/application/identity"
	endpointcommon "github.com/singaurora/exec-graph/backend/internal/http/endpoint/common"
	sharedid "github.com/singaurora/exec-graph/backend/internal/shared/id"
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
			got, err := applicationidentity.NormalizeEmail(test.value)
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
	if got := endpointcommon.BearerToken(request); got != "token-value" {
		t.Fatalf("bearerToken() = %q, want token-value", got)
	}
	request.Header.Set("Authorization", "Basic token-value")
	if got := endpointcommon.BearerToken(request); got != "" {
		t.Fatalf("bearerToken() accepted a non-Bearer scheme: %q", got)
	}
}

func TestNewOpaqueID(t *testing.T) {
	first, err := endpointcommon.NewOpaqueID("project")
	if err != nil {
		t.Fatalf("newOpaqueID(): %v", err)
	}
	second, err := endpointcommon.NewOpaqueID("project")
	if err != nil {
		t.Fatalf("newOpaqueID(): %v", err)
	}
	if first == second {
		t.Fatalf("newOpaqueID() returned duplicate IDs: %q", first)
	}
	if len(first) != 36 || first[8] != '-' || first[13] != '-' || first[18] != '-' || first[23] != '-' || first[14] != '4' {
		t.Fatalf("newOpaqueID() = %q, want an RFC 4122 version 4 UUID", first)
	}
}

func TestNewUserID(t *testing.T) {
	userID, err := sharedid.User()
	if err != nil {
		t.Fatalf("newUserID(): %v", err)
	}
	if _, err := applicationidentity.NormalizeUserID(userID); err != nil {
		t.Fatalf("newUserID() = %q, which does not match the user ID rules", userID)
	}
}
