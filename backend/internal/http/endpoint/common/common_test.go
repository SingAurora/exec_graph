package common

import (
	"net/http/httptest"
	"testing"
)

func TestBearerToken(t *testing.T) {
	request := httptest.NewRequest("GET", "/", nil)
	request.Header.Set("Authorization", "Bearer token-value")
	if got := BearerToken(request); got != "token-value" {
		t.Fatalf("BearerToken() = %q, want token-value", got)
	}
	request.Header.Set("Authorization", "Basic token-value")
	if got := BearerToken(request); got != "" {
		t.Fatalf("BearerToken() accepted a non-Bearer scheme: %q", got)
	}
}

func TestNewOpaqueID(t *testing.T) {
	first, err := NewOpaqueID("project")
	if err != nil {
		t.Fatalf("NewOpaqueID(): %v", err)
	}
	second, err := NewOpaqueID("project")
	if err != nil {
		t.Fatalf("NewOpaqueID(): %v", err)
	}
	if first == second {
		t.Fatalf("NewOpaqueID() returned duplicate IDs: %q", first)
	}
	if len(first) != 36 || first[8] != '-' || first[13] != '-' || first[18] != '-' || first[23] != '-' || first[14] != '4' {
		t.Fatalf("NewOpaqueID() = %q, want an RFC 4122 version 4 UUID", first)
	}
}
