package security

import (
	"encoding/base64"
	"strings"
	"testing"
)

func TestCredentialCipherRoundTripAndRejectsTampering(t *testing.T) {
	key := base64.StdEncoding.EncodeToString([]byte("0123456789abcdef0123456789abcdef"))
	cipher, err := NewCredentialCipher(key)
	if err != nil {
		t.Fatalf("NewCredentialCipher: %v", err)
	}
	encrypted, err := cipher.Encrypt("sk-secret-value")
	if err != nil {
		t.Fatalf("Encrypt: %v", err)
	}
	if encrypted == "sk-secret-value" || !cipher.IsEncrypted(encrypted) {
		t.Fatalf("unexpected ciphertext %q", encrypted)
	}
	plaintext, err := cipher.Decrypt(encrypted)
	if err != nil || plaintext != "sk-secret-value" {
		t.Fatalf("Decrypt = %q, %v", plaintext, err)
	}

	tampered := []byte(encrypted)
	tampered[len(tampered)/2] ^= 1
	_, err = cipher.Decrypt(string(tampered))
	if err == nil || strings.Contains(err.Error(), "sk-secret-value") {
		t.Fatal("tampered ciphertext was accepted")
	}
}
