// Package credentialmigration implements the explicit one-time credential deployment.
package credentialmigration

import (
	"context"
	"fmt"

	infrastructuresecurity "github.com/singaurora/exec-graph/backend/internal/infrastructure/security"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Report records how many legacy credential rows were converted.
type Report struct {
	PasswordsHashed int
	AIKeysEncrypted int
}

type userCredential struct {
	ID           uint64 `gorm:"column:id"`
	PasswordHash string `gorm:"column:password_hash"`
}

type aiKeyCredential struct {
	ID            uint64 `gorm:"column:id"`
	KeyCiphertext string `gorm:"column:key_ciphertext"`
}

// Apply converts every plaintext password and AI key in one transaction and
// refuses to commit unless all persisted credentials use the required formats.
func Apply(ctx context.Context, database *gorm.DB, hasher infrastructuresecurity.PasswordHasher, cipher *infrastructuresecurity.CredentialCipher) (Report, error) {
	report := Report{}
	err := database.WithContext(ctx).Transaction(func(transaction *gorm.DB) error {
		var users []userCredential
		if err := transaction.Table("users").Clauses(clause.Locking{Strength: "UPDATE"}).Find(&users).Error; err != nil {
			return fmt.Errorf("load user credentials: %w", err)
		}
		for _, user := range users {
			if hasher.IsHash(user.PasswordHash) {
				continue
			}
			hash, err := hasher.Hash(user.PasswordHash)
			if err != nil {
				return fmt.Errorf("hash password for user row %d: %w", user.ID, err)
			}
			if err := transaction.Table("users").Where("id = ?", user.ID).Update("password_hash", hash).Error; err != nil {
				return fmt.Errorf("update password for user row %d: %w", user.ID, err)
			}
			report.PasswordsHashed++
		}

		var keys []aiKeyCredential
		if err := transaction.Table("ai_api_keys").Clauses(clause.Locking{Strength: "UPDATE"}).Find(&keys).Error; err != nil {
			return fmt.Errorf("load AI credentials: %w", err)
		}
		for _, key := range keys {
			if cipher.IsEncrypted(key.KeyCiphertext) {
				continue
			}
			ciphertext, err := cipher.Encrypt(key.KeyCiphertext)
			if err != nil {
				return fmt.Errorf("encrypt AI key row %d: %w", key.ID, err)
			}
			if err := transaction.Table("ai_api_keys").Where("id = ?", key.ID).Update("key_ciphertext", ciphertext).Error; err != nil {
				return fmt.Errorf("update AI key row %d: %w", key.ID, err)
			}
			report.AIKeysEncrypted++
		}

		return verify(ctx, transaction, hasher, cipher)
	})
	if err != nil {
		return Report{}, err
	}
	return report, nil
}

func verify(ctx context.Context, database *gorm.DB, hasher infrastructuresecurity.PasswordHasher, cipher *infrastructuresecurity.CredentialCipher) error {
	var users []userCredential
	if err := database.WithContext(ctx).Table("users").Find(&users).Error; err != nil {
		return fmt.Errorf("verify user credentials: %w", err)
	}
	for _, user := range users {
		if !hasher.IsHash(user.PasswordHash) {
			return fmt.Errorf("user row %d does not contain a bcrypt password hash", user.ID)
		}
	}
	var keys []aiKeyCredential
	if err := database.WithContext(ctx).Table("ai_api_keys").Find(&keys).Error; err != nil {
		return fmt.Errorf("verify AI credentials: %w", err)
	}
	for _, key := range keys {
		if !cipher.IsEncrypted(key.KeyCiphertext) {
			return fmt.Errorf("AI key row %d does not contain encrypted ciphertext", key.ID)
		}
		if _, err := cipher.Decrypt(key.KeyCiphertext); err != nil {
			return fmt.Errorf("AI key row %d cannot be decrypted: %w", key.ID, err)
		}
	}
	return nil
}
