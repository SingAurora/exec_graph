package id

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
)

func Opaque(prefix string) (string, error) {
	value := make([]byte, 16)
	if _, err := rand.Read(value); err != nil {
		return "", fmt.Errorf("generate id: %w", err)
	}
	return fmt.Sprintf("%s-%s", prefix, hex.EncodeToString(value)), nil
}

func User() (string, error) {
	value := make([]byte, 10)
	if _, err := rand.Read(value); err != nil {
		return "", fmt.Errorf("generate user id: %w", err)
	}
	return "u" + hex.EncodeToString(value), nil
}

func SessionToken() (string, error) {
	value := make([]byte, 32)
	if _, err := rand.Read(value); err != nil {
		return "", fmt.Errorf("generate session token: %w", err)
	}
	return hex.EncodeToString(value), nil
}
