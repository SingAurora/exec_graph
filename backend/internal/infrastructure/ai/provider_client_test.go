package ai

import (
	"net/http"
	"net/netip"
	"testing"
	"time"

	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
)

func TestIsPublicAddress(t *testing.T) {
	tests := []struct {
		value string
		want  bool
	}{
		{value: "8.8.8.8", want: true},
		{value: "2606:4700:4700::1111", want: true},
		{value: "127.0.0.1", want: false},
		{value: "10.0.0.1", want: false},
		{value: "169.254.169.254", want: false},
		{value: "100.64.0.1", want: false},
		{value: "::1", want: false},
		{value: "fc00::1", want: false},
	}
	for _, test := range tests {
		t.Run(test.value, func(t *testing.T) {
			if got := isPublicAddress(netip.MustParseAddr(test.value)); got != test.want {
				t.Fatalf("isPublicAddress(%s) = %v, want %v", test.value, got, test.want)
			}
		})
	}
}

func TestHTTPClientUsesGenerationTimeout(t *testing.T) {
	client := NewProviderClient()
	want := 42 * time.Second
	httpClient := client.httpClient(want)
	if httpClient.Timeout != want {
		t.Fatalf("http client timeout = %s, want %s", httpClient.Timeout, want)
	}
	transport, ok := httpClient.Transport.(*http.Transport)
	if !ok {
		t.Fatalf("transport type = %T, want *http.Transport", httpClient.Transport)
	}
	if transport.ResponseHeaderTimeout != want {
		t.Fatalf("response header timeout = %s, want %s", transport.ResponseHeaderTimeout, want)
	}
	if got := client.httpClient(0).Timeout; got != sharedconstants.AIReviewHTTPTimeout {
		t.Fatalf("default timeout = %s, want %s", got, sharedconstants.AIReviewHTTPTimeout)
	}
}

func TestProviderErrorMessage(t *testing.T) {
	tests := []struct {
		name string
		body string
		want string
	}{
		{name: "openai compatible", body: `{"error":{"message":"The model does not exist"}}`, want: "The model does not exist"},
		{name: "top level message", body: `{"message":"quota exceeded"}`, want: "quota exceeded"},
		{name: "invalid response", body: "not json", want: ""},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := providerErrorMessage([]byte(test.body)); got != test.want {
				t.Fatalf("providerErrorMessage() = %q, want %q", got, test.want)
			}
		})
	}
}
