package config

import (
	"os"
	"path/filepath"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestWildcardOriginsAreAcceptedInProduction(t *testing.T) {
	body, err := os.ReadFile("../../../etc/config.example.yaml")
	if err != nil {
		t.Fatal(err)
	}
	var values map[string]any
	if err := yaml.Unmarshal(body, &values); err != nil {
		t.Fatal(err)
	}
	app := values["app"].(map[string]any)
	app["environment"] = "production"
	app["allowed_origins"] = []any{"*"}
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
	if len(loaded.App.AllowedOrigins) != 1 || loaded.App.AllowedOrigins[0] != "*" {
		t.Fatalf("通配来源未保留: %+v", loaded.App.AllowedOrigins)
	}
}
