package security

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"strings"
)

const encryptedCredentialPrefix = "v1:"

// CredentialCipher encrypts application credentials with AES-256-GCM.
type CredentialCipher struct {
	aead cipher.AEAD
}

// NewCredentialCipher builds a cipher from a base64-encoded 32-byte key.
func NewCredentialCipher(encodedKey string) (*CredentialCipher, error) {
	key, err := base64.StdEncoding.DecodeString(strings.TrimSpace(encodedKey))
	if err != nil || len(key) != 32 {
		return nil, errors.New("credential encryption key must be base64-encoded 32 bytes")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("create credential cipher: %w", err)
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("create credential AEAD: %w", err)
	}
	return &CredentialCipher{aead: aead}, nil
}

// Encrypt returns a versioned authenticated ciphertext.
func (cipher *CredentialCipher) Encrypt(plaintext string) (string, error) {
	nonce := make([]byte, cipher.aead.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("generate credential nonce: %w", err)
	}
	sealed := cipher.aead.Seal(nil, nonce, []byte(plaintext), nil)
	value := append(nonce, sealed...)
	return encryptedCredentialPrefix + base64.RawStdEncoding.EncodeToString(value), nil
}

// Decrypt authenticates and decrypts a versioned ciphertext.
func (cipher *CredentialCipher) Decrypt(value string) (string, error) {
	if !cipher.IsEncrypted(value) {
		return "", errors.New("credential is not encrypted")
	}
	encoded := strings.TrimPrefix(value, encryptedCredentialPrefix)
	contents, err := base64.RawStdEncoding.DecodeString(encoded)
	if err != nil || len(contents) <= cipher.aead.NonceSize() {
		return "", errors.New("credential ciphertext is invalid")
	}
	nonce, ciphertext := contents[:cipher.aead.NonceSize()], contents[cipher.aead.NonceSize():]
	plaintext, err := cipher.aead.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", errors.New("credential ciphertext authentication failed")
	}
	return string(plaintext), nil
}

// IsEncrypted reports whether value uses the supported ciphertext format.
func (*CredentialCipher) IsEncrypted(value string) bool {
	return strings.HasPrefix(value, encryptedCredentialPrefix)
}
