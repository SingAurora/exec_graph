package request

import (
	"io"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestDecodeJSONRejectsTrailingValue(t *testing.T) {
	request := httptest.NewRequest("POST", "/", strings.NewReader(`{"name":"first"}{"name":"second"}`))
	var target struct {
		Name string `json:"name"`
	}
	if err := DecodeJSON(request, &target); err == nil {
		t.Fatal("DecodeJSON accepted a second JSON value")
	}
}

func TestStringReadsJSONAndRestoresBody(t *testing.T) {
	request := httptest.NewRequest("POST", "/", strings.NewReader(`{"projectId":" project-1 ","title":"test"}`))
	value, err := String(request, "projectId")
	if err != nil {
		t.Fatalf("String returned an error: %v", err)
	}
	if value != "project-1" {
		t.Fatalf("String = %q, want project-1", value)
	}
	restored, err := io.ReadAll(request.Body)
	if err != nil {
		t.Fatalf("read restored body: %v", err)
	}
	if string(restored) != `{"projectId":" project-1 ","title":"test"}` {
		t.Fatalf("restored body = %q", restored)
	}
}

func TestStringPrefersQueryValue(t *testing.T) {
	request := httptest.NewRequest("GET", "/?projectId=project-from-query", nil)
	value, err := String(request, "projectId")
	if err != nil {
		t.Fatalf("String returned an error: %v", err)
	}
	if value != "project-from-query" {
		t.Fatalf("String = %q, want project-from-query", value)
	}
}
