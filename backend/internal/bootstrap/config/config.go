// Package config 读取启动配置，兼容旧项目的本地 YAML。
package config

import (
	"bytes"
	"fmt"
	"io"
	"net"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

// Config 使用中性的能力命名；旧云配置保留读取兼容性。
type Config struct {
	App         App           `yaml:"app"`
	Database    Database      `yaml:"database"`
	Redis       Redis         `yaml:"redis"`
	Credentials Credentials   `yaml:"credentials"`
	Mail        Mail          `yaml:"mail"`
	Storage     ObjectStorage `yaml:"storage"`
	AI          AI            `yaml:"ai"`
	Security    Security      `yaml:"security"`
	Limits      Limits        `yaml:"limits"`
}

// App 是 HTTP 和会话配置。
type App struct {
	Host            string   `yaml:"host"`
	Port            int      `yaml:"port"`
	SessionTTLHours int      `yaml:"session_ttl_hours"`
	AllowedOrigins  []string `yaml:"allowed_origins"`
	Environment     string   `yaml:"environment"`
	EnableDemoLogin bool     `yaml:"enable_demo_login"`
	FrontendDir     string   `yaml:"frontend_dir"`
}

// Database 是 MySQL 配置，业务模型不感知连接信息。
type Database struct {
	Host     string `yaml:"host"`
	Port     int    `yaml:"port"`
	Schema   string `yaml:"schema"`
	User     string `yaml:"user"`
	Password string `yaml:"password"`
	Charset  string `yaml:"charset"`
}

// Redis 是会话存储配置，Prefix 隔离本版本与旧项目键空间。
type Redis struct {
	Host     string `yaml:"host"`
	Port     int    `yaml:"port"`
	Password string `yaml:"password"`
	Database int    `yaml:"database"`
	Prefix   string `yaml:"prefix"`
}

// Credentials 兼容现有云服务凭据，不进入 API。
type Credentials struct {
	AccessKeyID     string `yaml:"access_key_id"`
	AccessKeySecret string `yaml:"access_key_secret"`
}

// Mail 兼容现有邮件模板配置。
type Mail struct {
	Enabled        bool   `yaml:"enabled"`
	Region         string `yaml:"region"`
	TemplateID     uint64 `yaml:"template_id"`
	FromEmail      string `yaml:"from_email"`
	CodeTTLMinutes int    `yaml:"code_ttl_minutes"`
}

// ObjectStorage 兼容现有对象存储配置。
type ObjectStorage struct {
	Enabled      bool   `yaml:"enabled"`
	MediaPrefix  string `yaml:"media_prefix"`
	Region       string `yaml:"region"`
	Bucket       string `yaml:"bucket"`
	AvatarPrefix string `yaml:"avatar_prefix"`
}

// AI 是仅服务端持有的平台模型配置，不支持用户密钥。
type AI struct {
	BaseURL string `yaml:"base_url"`
	Model   string `yaml:"model"`
	APIKey  string `yaml:"api_key"`
}

// Security 仅为旧配置解析保留，当前不恢复个人 AI Key 的加密存储。
type Security struct {
	CredentialEncryptionKey string `yaml:"credential_encryption_key"`
}

var schemaPattern = regexp.MustCompile(`^[A-Za-z0-9_]{1,64}$`)

// ValidSchema 限制数据库管理命令允许操作的 schema 标识符。
func ValidSchema(value string) bool { return schemaPattern.MatchString(value) }

// Load 严格解析配置，仅允许已知字段；错误不回显密钥或 YAML 内容。
func Load(path string) (Config, error) {
	contents, err := os.ReadFile(path)
	if err != nil {
		return Config{}, fmt.Errorf("读取配置文件失败: %w", err)
	}
	c := Config{App: App{Environment: "development"}, Redis: Redis{Prefix: "exec_graph:v1:"}, Limits: defaultLimits()}
	decoder := yaml.NewDecoder(bytes.NewReader(contents))
	decoder.KnownFields(true)
	if err := decoder.Decode(&c); err != nil {
		return Config{}, fmt.Errorf("配置 YAML 格式或字段不合法")
	}
	var extra any
	if err := decoder.Decode(&extra); err != io.EOF {
		return Config{}, fmt.Errorf("配置只能包含一份 YAML 文档")
	}
	if err := validateLimitNumbers(contents); err != nil {
		return Config{}, err
	}
	if err := c.Limits.validate(); err != nil {
		return Config{}, err
	}
	if schema := os.Getenv("EXEC_GRAPH_DATABASE_SCHEMA"); schema != "" {
		c.Database.Schema = schema
	}
	if enabled := os.Getenv("EXEC_GRAPH_STORAGE_ENABLED"); enabled != "" {
		c.Storage.Enabled, err = strconv.ParseBool(enabled)
		if err != nil {
			return Config{}, fmt.Errorf("EXEC_GRAPH_STORAGE_ENABLED 必须为布尔值")
		}
	}
	if c.Storage.MediaPrefix == "" {
		c.Storage.MediaPrefix = "exec-graph/v1/media"
	}
	if c.AI.BaseURL == "" {
		c.AI.BaseURL = "https://api.deepseek.com"
	}
	if c.AI.Model == "" {
		c.AI.Model = "deepseek-flash"
	}
	if value := os.Getenv("DEEPSEEK_API_KEY"); value != "" {
		c.AI.APIKey = value
	}
	if value := os.Getenv("EXEC_GRAPH_AI_BASE_URL"); value != "" {
		c.AI.BaseURL = value
	}
	if value := os.Getenv("EXEC_GRAPH_AI_MODEL"); value != "" {
		c.AI.Model = value
	}
	if enabled := os.Getenv("EXEC_GRAPH_MAIL_ENABLED"); enabled != "" {
		c.Mail.Enabled, err = strconv.ParseBool(enabled)
		if err != nil {
			return Config{}, fmt.Errorf("EXEC_GRAPH_MAIL_ENABLED 必须为布尔值")
		}
	}
	if c.Mail.CodeTTLMinutes == 0 {
		c.Mail.CodeTTLMinutes = 10
	}
	if c.Mail.CodeTTLMinutes < 1 || c.Mail.CodeTTLMinutes > 30 {
		return Config{}, fmt.Errorf("mail.code_ttl_minutes 必须在 1 到 30 分钟之间")
	}
	if prefix := os.Getenv("EXEC_GRAPH_REDIS_PREFIX"); prefix != "" {
		c.Redis.Prefix = prefix
	}
	if environment := os.Getenv("EXEC_GRAPH_ENV"); environment != "" {
		c.App.Environment = environment
	}
	if directory := os.Getenv("EXEC_GRAPH_FRONTEND_DIR"); directory != "" {
		c.App.FrontendDir = directory
	}
	if origins := os.Getenv("EXEC_GRAPH_ALLOWED_ORIGINS"); origins != "" {
		c.App.AllowedOrigins = strings.Split(origins, ",")
	}
	if enabled := os.Getenv("EXEC_GRAPH_ENABLE_DEMO_LOGIN"); enabled != "" {
		c.App.EnableDemoLogin, err = strconv.ParseBool(enabled)
		if err != nil {
			return Config{}, fmt.Errorf("EXEC_GRAPH_ENABLE_DEMO_LOGIN 必须为布尔值")
		}
	}
	if address := os.Getenv("EXEC_GRAPH_ADDR"); address != "" {
		host, port, err := net.SplitHostPort(address)
		if err != nil {
			return Config{}, fmt.Errorf("EXEC_GRAPH_ADDR 格式应为 host:port")
		}
		c.App.Host, c.App.Port = host, 0
		c.App.Port, err = strconv.Atoi(port)
		if err != nil {
			return Config{}, fmt.Errorf("EXEC_GRAPH_ADDR 端口不合法")
		}
	}
	if c.Database.Host == "" || c.Database.User == "" || !ValidSchema(c.Database.Schema) || !port(c.Database.Port) {
		return Config{}, fmt.Errorf("database 配置不完整或不合法")
	}
	if c.Database.Charset == "" {
		c.Database.Charset = "utf8mb4"
	}
	if c.Database.Charset != "utf8mb4" {
		return Config{}, fmt.Errorf("database.charset 必须为 utf8mb4")
	}
	if c.Redis.Host == "" || !port(c.Redis.Port) || c.Redis.Database < 0 || strings.TrimSpace(c.Redis.Prefix) == "" {
		return Config{}, fmt.Errorf("redis 配置不完整或不合法")
	}
	if !port(c.App.Port) || c.App.SessionTTLHours < 1 || c.App.SessionTTLHours > 720 || len(c.App.AllowedOrigins) == 0 {
		return Config{}, fmt.Errorf("app 配置不完整或不合法")
	}
	for _, origin := range c.App.AllowedOrigins {
		parsed, err := url.Parse(origin)
		if err != nil || parsed.Host == "" || parsed.User != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.RawQuery != "" || parsed.Fragment != "" || parsed.Path != "" {
			return Config{}, fmt.Errorf("app.allowed_origins 必须是明确的 HTTP Origin")
		}
	}
	if c.App.Environment != "development" && c.App.Environment != "production" && c.App.Environment != "test" {
		return Config{}, fmt.Errorf("app.environment 不合法")
	}
	if c.App.Environment == "production" && c.App.EnableDemoLogin {
		return Config{}, fmt.Errorf("生产环境禁止启用演示登录")
	}
	return c, nil
}

// Path 返回配置路径，保持旧项目的环境变量兼容。
func Path() string {
	if value := os.Getenv("EXEC_GRAPH_CONFIG"); value != "" {
		return value
	}
	return "etc/config.local.yaml"
}

// SessionTTL 将已验证的小时数转为会话有效期。
func (c App) SessionTTL() time.Duration { return time.Duration(c.SessionTTLHours) * time.Hour }

func port(value int) bool { return value > 0 && value <= 65535 }
