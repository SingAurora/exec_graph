package ai

import (
	"net/netip"
	"testing"
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
