package config

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

type Config struct {
	App         AppConfig           `yaml:"app"`
	Database    DatabaseConfig      `yaml:"database"`
	Redis       RedisConfig         `yaml:"redis"`
	Credentials CredentialsConfig   `yaml:"credentials"`
	Mail        MailConfig          `yaml:"mail"`
	Storage     ObjectStorageConfig `yaml:"storage"`
	Development DevelopmentConfig   `yaml:"development"`
}

type AppConfig struct {
	Host            string `yaml:"host"`
	Port            int    `yaml:"port"`
	SessionTTLHours int    `yaml:"session_ttl_hours"`
}

type DatabaseConfig struct {
	Driver   string `yaml:"driver"`
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
	Region            string            `yaml:"region"`
	TemplateID        uint64            `yaml:"template_id"`
	TemplateBody      string            `yaml:"template_body"`
	TemplateVariables map[string]string `yaml:"template_variables"`
	FromEmail         string            `yaml:"from_email"`
	FromDomain        string            `yaml:"from_domain"`
	CodeTTLMinutes    int               `yaml:"code_ttl_minutes"`
}

type ObjectStorageConfig struct {
	Region       string `yaml:"region"`
	Bucket       string `yaml:"bucket"`
	AvatarPrefix string `yaml:"avatar_prefix"`
}

type DevelopmentConfig struct {
	TestAccount TestAccountConfig `yaml:"test_account"`
}

type TestAccountConfig struct {
	Enabled  bool   `yaml:"enabled"`
	Username string `yaml:"username"`
	Email    string `yaml:"email"`
	Password string `yaml:"password"`
}

func Load(path string) (Config, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return Config{}, fmt.Errorf("read config: %w", err)
	}

	var config Config
	if err := yaml.Unmarshal(content, &config); err != nil {
		return Config{}, fmt.Errorf("parse config: %w", err)
	}
	if config.App.Port == 0 {
		config.App.Port = 8080
	}
	if config.App.SessionTTLHours == 0 {
		config.App.SessionTTLHours = 168
	}
	if config.Database.Charset == "" {
		config.Database.Charset = "utf8mb4"
	}
	if config.Redis.Port == 0 {
		config.Redis.Port = 6379
	}
	if config.Mail.CodeTTLMinutes == 0 {
		config.Mail.CodeTTLMinutes = 10
	}
	if config.Storage.AvatarPrefix == "" {
		config.Storage.AvatarPrefix = "avatars/"
	}
	return config, nil
}
