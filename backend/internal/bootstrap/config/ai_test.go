package config

import (
	"os"
	"path/filepath"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestAIModelDefaultsUseDeepSeekPro(t *testing.T) {
	for _, name := range []string{"EXEC_GRAPH_AI_MODEL", "EXEC_GRAPH_AI_DRAFT_MODEL", "EXEC_GRAPH_AI_ANALYSIS_MODEL"} {
		t.Setenv(name, "")
	}
	body, err := os.ReadFile("../../../etc/config.example.yaml")
	if err != nil {
		t.Fatal(err)
	}
	var values map[string]any
	if err := yaml.Unmarshal(body, &values); err != nil {
		t.Fatal(err)
	}
	aiConfig := values["ai"].(map[string]any)
	aiConfig["model"] = "deepseek-flash"
	delete(aiConfig, "draft_model")
	delete(aiConfig, "analysis_model")
	body, err = yaml.Marshal(values)
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(t.TempDir(), "config.yaml")
	if err := os.WriteFile(path, body, 0600); err != nil {
		t.Fatal(err)
	}
	loaded, err := Load(path)
	if err != nil {
		t.Fatal(err)
	}
	if loaded.AI.DraftModel != "deepseek-v4-pro" || loaded.AI.AnalysisModel != "deepseek-v4-pro" {
		t.Fatalf("AI 默认模型未统一为 Pro: draft=%q analysis=%q", loaded.AI.DraftModel, loaded.AI.AnalysisModel)
	}
	if loaded.AI.Model != "deepseek-flash" {
		t.Fatalf("旧配置应保留可读取但不覆盖模型默认值: model=%q", loaded.AI.Model)
	}
}
