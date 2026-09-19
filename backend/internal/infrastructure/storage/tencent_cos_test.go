package storage

import (
	"testing"

	bootstrapconfig "github.com/singaurora/exec-graph/backend/internal/bootstrap/config"
)

func TestNewObjectKeyUsesConfiguredPrefix(t *testing.T) {
	storage, err := NewTencentCOS(
		bootstrapconfig.ObjectStorageConfig{
			Region:       "ap-guangzhou",
			Bucket:       "example-bucket",
			AvatarPrefix: "objects/",
		},
		bootstrapconfig.CredentialsConfig{
			AccessKeyID:     "access-key-id",
			AccessKeySecret: "access-key-secret",
		},
	)
	if err != nil {
		t.Fatalf("NewTencentCOS() error = %v", err)
	}

	key, err := storage.NewObjectKey("users", "42", "avatar.jpg")
	if err != nil {
		t.Fatalf("NewObjectKey() error = %v", err)
	}
	if key != "objects/users/42/avatar.jpg" {
		t.Fatalf("NewObjectKey() = %q, want %q", key, "objects/users/42/avatar.jpg")
	}
	if !storage.IsManagedObjectKey(key) {
		t.Fatalf("IsManagedObjectKey(%q) = false, want true", key)
	}
}

func TestObjectKeyRejectsUnsafePaths(t *testing.T) {
	storage, err := NewTencentCOS(
		bootstrapconfig.ObjectStorageConfig{
			Region:       "ap-guangzhou",
			Bucket:       "example-bucket",
			AvatarPrefix: "objects/",
		},
		bootstrapconfig.CredentialsConfig{
			AccessKeyID:     "access-key-id",
			AccessKeySecret: "access-key-secret",
		},
	)
	if err != nil {
		t.Fatalf("NewTencentCOS() error = %v", err)
	}

	for _, parts := range [][]string{{"users", "..", "secret"}, {"/outside"}, {"users", "..\\secret"}} {
		if key, err := storage.NewObjectKey(parts...); err == nil || key != "" {
			t.Fatalf("NewObjectKey(%q) = (%q, %v), want an error", parts, key, err)
		}
	}
	if storage.IsManagedObjectKey("objects/../secret") {
		t.Fatal("IsManagedObjectKey() accepted a traversal path")
	}
	if storage.IsManagedObjectKey("other/secret") {
		t.Fatal("IsManagedObjectKey() accepted a key outside the configured prefix")
	}
}

func TestImageExtension(t *testing.T) {
	tests := []struct {
		contentType string
		want        string
		valid       bool
	}{
		{contentType: "image/jpeg", want: ".jpg", valid: true},
		{contentType: "image/png", want: ".png", valid: true},
		{contentType: "image/webp", want: ".webp", valid: true},
		{contentType: "image/gif", valid: false},
	}
	for _, test := range tests {
		got, valid := ImageExtension(test.contentType)
		if got != test.want || valid != test.valid {
			t.Errorf("ImageExtension(%q) = (%q, %t), want (%q, %t)", test.contentType, got, valid, test.want, test.valid)
		}
	}
}
