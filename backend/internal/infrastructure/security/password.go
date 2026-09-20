// Package security implements credential protection used by application ports.
package security

import (
	"fmt"

	"golang.org/x/crypto/bcrypt"
)

const passwordHashCost = 12

// PasswordHasher hashes and verifies account passwords with bcrypt.
type PasswordHasher struct{}

// Hash returns a bcrypt password hash suitable for persistence.
func (PasswordHasher) Hash(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), passwordHashCost)
	if err != nil {
		return "", fmt.Errorf("hash password: %w", err)
	}
	return string(hash), nil
}

// Verify reports whether password matches a persisted bcrypt hash.
func (PasswordHasher) Verify(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

// IsHash reports whether value is a structurally valid bcrypt hash.
func (PasswordHasher) IsHash(value string) bool {
	_, err := bcrypt.Cost([]byte(value))
	return err == nil
}
