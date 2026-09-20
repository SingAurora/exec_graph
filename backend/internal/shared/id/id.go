package id

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
)

// Opaque 创建带业务前缀的随机对象键；它不用于公开资源 UUID。
func Opaque(prefix string) (string, error) {
	value := make([]byte, 16)
	if _, err := rand.Read(value); err != nil {
		return "", fmt.Errorf("generate id: %w", err)
	}
	return fmt.Sprintf("%s-%s", prefix, hex.EncodeToString(value)), nil
}

// UUID returns an RFC 4122 version 4 UUID for identifiers exposed by the API.
func UUID() (string, error) {
	value := make([]byte, 16)
	if _, err := rand.Read(value); err != nil {
		return "", fmt.Errorf("generate uuid: %w", err)
	}
	value[6] = value[6]&0x0f | 0x40
	value[8] = value[8]&0x3f | 0x80
	encoded := hex.EncodeToString(value)
	return fmt.Sprintf("%s-%s-%s-%s-%s", encoded[0:8], encoded[8:12], encoded[12:16], encoded[16:20], encoded[20:32]), nil
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
