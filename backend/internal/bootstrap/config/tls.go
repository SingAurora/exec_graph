package config

import (
	"fmt"
	"net"
	"path/filepath"
	"regexp"
	"strings"
)

// TLS 配置 Go 自动申请和续期的域名证书；关闭时保持原有 HTTP 服务。
type TLS struct {
	Enabled  bool     `yaml:"enabled"`
	Domains  []string `yaml:"domains"`
	CacheDir string   `yaml:"cache_dir"`
}

var domainLabel = regexp.MustCompile(`^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$`)

func (c TLS) validate(httpPort int) error {
	if !c.Enabled {
		return nil
	}
	if httpPort != 80 {
		return fmt.Errorf("启用自动 HTTPS 时 app.port 必须为 80，用于证书验证和跳转")
	}
	if !filepath.IsAbs(c.CacheDir) || strings.TrimSpace(c.CacheDir) != c.CacheDir {
		return fmt.Errorf("app.tls.cache_dir 必须是独立于发布目录的绝对路径")
	}
	if len(c.Domains) == 0 {
		return fmt.Errorf("app.tls.domains 必须明确指定证书域名")
	}
	seen := make(map[string]bool)
	for _, domain := range c.Domains {
		labels := strings.Split(domain, ".")
		if len(domain) > 253 || len(labels) < 2 || net.ParseIP(domain) != nil || seen[domain] {
			return fmt.Errorf("app.tls.domains 必须是不重复的小写完整域名，不含协议、端口或 IP")
		}
		for _, label := range labels {
			if !domainLabel.MatchString(label) {
				return fmt.Errorf("app.tls.domains 必须是不重复的小写完整域名，不含协议、端口或 IP")
			}
		}
		seen[domain] = true
	}
	return nil
}
