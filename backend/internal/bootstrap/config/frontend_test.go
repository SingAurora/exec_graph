package config

import (
	"os"
	"path/filepath"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestFrontendDirectoryConfiguration(t *testing.T) {
	t.Setenv("EXEC_GRAPH_FRONTEND_DIR", "")
	c, err := Load("../../../etc/config.example.yaml")
	if err != nil || c.App.FrontendDir != "" {
		t.Fatalf("默认应仅提供 API: %v", err)
	}
	body, err := os.ReadFile("../../../etc/config.example.yaml")
	if err != nil {
		t.Fatal(err)
	}
	var yamlConfig map[string]any
	// 使用正式 YAML 解析器覆盖示例配置，避免依赖注释或字段顺序。
	if err := yaml.Unmarshal(body, &yamlConfig); err != nil {
		t.Fatal(err)
	}
	yamlConfig["app"].(map[string]any)["frontend_dir"] = "../frontend/dist"
	body, err = yaml.Marshal(yamlConfig)
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(t.TempDir(), "config.yaml")
	if err := os.WriteFile(path, body, 0600); err != nil {
		t.Fatal(err)
	}
	c, err = Load(path)
	if err != nil || c.App.FrontendDir != "../frontend/dist" {
		t.Fatalf("YAML 前端目录未生效: %v", err)
	}
	t.Setenv("EXEC_GRAPH_FRONTEND_DIR", "/srv/exec_graph/frontend/dist")
	c, err = Load(path)
	if err != nil || c.App.FrontendDir != "/srv/exec_graph/frontend/dist" {
		t.Fatalf("环境变量未覆盖 YAML: %v", err)
	}
}
