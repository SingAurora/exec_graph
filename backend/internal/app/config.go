package app

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

type Config struct {
	App      AppConfig      `yaml:"app"`
	Database DatabaseConfig `yaml:"database"`
	Redis    RedisConfig    `yaml:"redis"`
	Tencent  TencentConfig  `yaml:"tencent"`
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

type TencentConfig struct {
	SES SESConfig `yaml:"ses"`
	COS COSConfig `yaml:"cos"`
}

type SESConfig struct {
	Region            string            `yaml:"region"`
	TemplateID        uint64            `yaml:"template_id"`
	TemplateBody      string            `yaml:"template_body"`
	TemplateVariables map[string]string `yaml:"template_variables"`
	FromEmail         string            `yaml:"from_email"`
	FromDomain        string            `yaml:"from_domain"`
	SecretID          string            `yaml:"secret_id"`
	SecretKey         string            `yaml:"secret_key"`
	CodeTTLMinutes    int               `yaml:"code_ttl_minutes"`
}

type COSConfig struct {
	Region       string `yaml:"region"`
	Bucket       string `yaml:"bucket"`
	AvatarPrefix string `yaml:"avatar_prefix"`
}

func loadConfig(path string) (Config, error) {
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
	if config.Tencent.SES.CodeTTLMinutes == 0 {
		config.Tencent.SES.CodeTTLMinutes = 10
	}
	if config.Tencent.COS.AvatarPrefix == "" {
		config.Tencent.COS.AvatarPrefix = "avatars/"
	}
	return config, nil
}
