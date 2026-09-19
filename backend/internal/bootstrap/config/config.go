package config

import (
	"bytes"
	"fmt"
	"net/mail"
	"os"
	"strings"

	"gopkg.in/yaml.v3"
)

type Config struct {
	App         AppConfig           `yaml:"app"`
	Database    DatabaseConfig      `yaml:"database"`
	Redis       RedisConfig         `yaml:"redis"`
	Credentials CredentialsConfig   `yaml:"credentials"`
	Mail        MailConfig          `yaml:"mail"`
	Storage     ObjectStorageConfig `yaml:"storage"`
}

type AppConfig struct {
	Host            string `yaml:"host"`
	Port            int    `yaml:"port"`
	SessionTTLHours int    `yaml:"session_ttl_hours"`
}

type DatabaseConfig struct {
	Host     string `yaml:"host"`
	Port     int    `yaml:"port"`
	Name     string `yaml:"name"`
	User     string `yaml:"user"`
	Password string `yaml:"password"`
	Charset  string `yaml:"charset"`
}

type RedisConfig struct {
	Host     string `yaml:"host"`
	Port     int    `yaml:"port"`
	Password string `yaml:"password"`
	Database int    `yaml:"database"`
}

type CredentialsConfig struct {
	AccessKeyID     string `yaml:"access_key_id"`
	AccessKeySecret string `yaml:"access_key_secret"`
}

type MailConfig struct {
	Region         string `yaml:"region"`
	TemplateID     uint64 `yaml:"template_id"`
	FromEmail      string `yaml:"from_email"`
	CodeTTLMinutes int    `yaml:"code_ttl_minutes"`
}

type ObjectStorageConfig struct {
	Region       string `yaml:"region"`
	Bucket       string `yaml:"bucket"`
	AvatarPrefix string `yaml:"avatar_prefix"`
}

func Load(path string) (Config, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return Config{}, fmt.Errorf("read config: %w", err)
	}

	var config Config
	decoder := yaml.NewDecoder(bytes.NewReader(content))
	decoder.KnownFields(true)
	if err := decoder.Decode(&config); err != nil {
		return Config{}, fmt.Errorf("parse config: %w", err)
	}
	if err := validate(config); err != nil {
		return Config{}, fmt.Errorf("validate config: %w", err)
	}
	return config, nil
}

func validate(config Config) error {
	invalid := make([]string, 0)
	requireText := func(path, value string) {
		if strings.TrimSpace(value) == "" {
			invalid = append(invalid, path)
		}
	}
	requirePort := func(path string, value int) {
		if value < 1 || value > 65535 {
			invalid = append(invalid, path)
		}
	}

	requireText("app.host", config.App.Host)
	requirePort("app.port", config.App.Port)
	if config.App.SessionTTLHours <= 0 {
		invalid = append(invalid, "app.session_ttl_hours")
	}

	requireText("database.host", config.Database.Host)
	requirePort("database.port", config.Database.Port)
	requireText("database.name", config.Database.Name)
	requireText("database.user", config.Database.User)
	requireText("database.password", config.Database.Password)
	requireText("database.charset", config.Database.Charset)

	requireText("redis.host", config.Redis.Host)
	requirePort("redis.port", config.Redis.Port)
	requireText("redis.password", config.Redis.Password)
	if config.Redis.Database < 0 {
		invalid = append(invalid, "redis.database")
	}

	requireText("credentials.access_key_id", config.Credentials.AccessKeyID)
	requireText("credentials.access_key_secret", config.Credentials.AccessKeySecret)

	requireText("mail.region", config.Mail.Region)
	if config.Mail.TemplateID == 0 {
		invalid = append(invalid, "mail.template_id")
	}
	if strings.TrimSpace(config.Mail.FromEmail) == "" {
		invalid = append(invalid, "mail.from_email")
	} else if _, err := mail.ParseAddress(config.Mail.FromEmail); err != nil {
		invalid = append(invalid, "mail.from_email")
	}
	if config.Mail.CodeTTLMinutes <= 0 {
		invalid = append(invalid, "mail.code_ttl_minutes")
	}

	requireText("storage.region", config.Storage.Region)
	requireText("storage.bucket", config.Storage.Bucket)
	requireText("storage.avatar_prefix", config.Storage.AvatarPrefix)

	if len(invalid) > 0 {
		return fmt.Errorf("required fields are missing or invalid: %s", strings.Join(invalid, ", "))
	}
	return nil
}
