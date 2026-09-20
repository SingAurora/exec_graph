package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const validConfig = `app:
  host: 127.0.0.1
  port: 8080
  session_ttl_hours: 168
database:
  host: 127.0.0.1
  port: 3306
  schema: exec_graph
  user: root
  password: local-password
  charset: utf8mb4
redis:
  host: 127.0.0.1
  port: 6379
  password: redis-password
  database: 0
credentials:
  access_key_id: access-key-id
  access_key_secret: access-key-secret
mail:
  region: ap-guangzhou
  template_id: 29256
  from_email: no-reply@example.com
  code_ttl_minutes: 10
storage:
  region: ap-guangzhou
  bucket: exec-graph-1253847355
  avatar_prefix: avatars/
`

func TestLoadRequiresExplicitOperationalValues(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.yaml")
	content := strings.Replace(validConfig, "  session_ttl_hours: 168\n", "", 1)
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("write config: %v", err)
	}

	_, err := Load(path)
	if err == nil || !strings.Contains(err.Error(), "app.session_ttl_hours") {
		t.Fatalf("Load() error = %v, want missing app.session_ttl_hours", err)
	}
}

func TestLoadRejectsMissingInfrastructureSettings(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.yaml")
	content := strings.NewReplacer(
		"  host: 127.0.0.1\n", "",
		"  password: redis-password\n", "",
		"  access_key_secret: access-key-secret\n", "",
		"  bucket: exec-graph-1253847355\n", "",
	).Replace(validConfig)
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("write config: %v", err)
	}

	_, err := Load(path)
	if err == nil {
		t.Fatal("Load() error = nil, want invalid infrastructure settings")
	}
	for _, field := range []string{"database.host", "redis.host", "redis.password", "credentials.access_key_secret", "storage.bucket"} {
		if !strings.Contains(err.Error(), field) {
			t.Errorf("Load() error = %q, want %q", err, field)
		}
	}
}

func TestLoadRejectsUnknownFields(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.yaml")
	if err := os.WriteFile(path, []byte(validConfig+"unknown_setting: true\n"), 0o600); err != nil {
		t.Fatalf("write config: %v", err)
	}

	_, err := Load(path)
	if err == nil || !strings.Contains(err.Error(), "unknown_setting") {
		t.Fatalf("Load() error = %v, want unknown field error", err)
	}
}

func TestLoadKeepsExplicitOperationalValues(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.yaml")
	if err := os.WriteFile(path, []byte(validConfig), 0o600); err != nil {
		t.Fatalf("write config: %v", err)
	}

	config, err := Load(path)
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if config.App.Port != 8080 || config.App.SessionTTLHours != 168 || config.Database.Charset != "utf8mb4" || config.Redis.Port != 6379 || config.Mail.CodeTTLMinutes != 10 || config.Storage.AvatarPrefix != "avatars/" {
		t.Fatalf("Load() retained unexpected operational values: %#v", config)
	}
}
