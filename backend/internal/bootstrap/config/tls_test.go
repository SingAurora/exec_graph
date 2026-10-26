package config

import (
	"os"
	"path/filepath"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestTLSConfiguration(t *testing.T) {
	body, err := os.ReadFile("../../../etc/config.example.yaml")
	if err != nil {
		t.Fatal(err)
	}
	var base Config
	if err := yaml.Unmarshal(body, &base); err != nil {
		t.Fatal(err)
	}
	for _, test := range []struct {
		name    string
		port    int
		tls     TLS
		invalid bool
	}{
		{"disabled", 8081, TLS{}, false},
		{"two_domains", 80, TLS{true, []string{"yinxu.fun", "www.yinxu.fun"}, "/var/lib/exec-graph/autocert"}, false},
		{"missing_domain", 80, TLS{true, nil, "/tmp/certs"}, true},
		{"relative_cache", 80, TLS{true, []string{"yinxu.fun"}, "certs"}, true},
		{"wrong_http_port", 8081, TLS{true, []string{"yinxu.fun"}, "/tmp/certs"}, true},
		{"ip", 80, TLS{true, []string{"115.159.206.123"}, "/tmp/certs"}, true},
		{"wildcard", 80, TLS{true, []string{"*.yinxu.fun"}, "/tmp/certs"}, true},
		{"url", 80, TLS{true, []string{"https://yinxu.fun"}, "/tmp/certs"}, true},
		{"duplicate", 80, TLS{true, []string{"yinxu.fun", "yinxu.fun"}, "/tmp/certs"}, true},
		{"invalid_label", 80, TLS{true, []string{"www.-yinxu.fun"}, "/tmp/certs"}, true},
	} {
		t.Run(test.name, func(t *testing.T) {
			c := base
			c.App.Port, c.App.TLS = test.port, test.tls
			body, err := yaml.Marshal(c)
			if err != nil {
				t.Fatal(err)
			}
			path := filepath.Join(t.TempDir(), "config.yaml")
			if err := os.WriteFile(path, body, 0600); err != nil {
				t.Fatal(err)
			}
			loaded, err := Load(path)
			if (err != nil) != test.invalid {
				t.Fatalf("配置验证结果不符: %v", err)
			}
			if err == nil && loaded.App.TLS.Enabled != test.tls.Enabled {
				t.Fatal("TLS 开关未从 YAML 生效")
			}
		})
	}
}
