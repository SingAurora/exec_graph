package request

import (
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
