package bootstrap

import (
	"io/fs"
	"os"
	"path/filepath"
	"testing"
)

func TestFrontendFiles(t *testing.T) {
	files, err := frontendFiles("")
	if err != nil || files != nil {
		t.Fatal("未配置前端目录时不应启用静态服务")
	}
	directory := t.TempDir()
	if _, err := frontendFiles(filepath.Join(directory, "missing")); err == nil {
		t.Fatal("目录不存在时应拒绝启动")
	}
	if _, err := frontendFiles(directory); err == nil {
		t.Fatal("未构建入口时应拒绝启动")
	}
	index := filepath.Join(directory, "index.html")
	if err := os.Mkdir(index, 0700); err != nil {
		t.Fatal(err)
	}
	if _, err := frontendFiles(directory); err == nil {
		t.Fatal("目录不能充当前端入口")
	}
	if err := os.Remove(index); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(index, []byte("<!doctype html>"), 0600); err != nil {
		t.Fatal(err)
	}
	files, err = frontendFiles(directory)
	if err != nil {
		t.Fatal(err)
	}
	contents, err := fs.ReadFile(files, "index.html")
	if err != nil || string(contents) != "<!doctype html>" {
		t.Fatalf("构建入口读取失败: %q %v", contents, err)
	}
	if _, err := files.Open("../etc/config.local.yaml"); err == nil {
		t.Fatal("不能使用父路径读取构建目录以外的文件")
	}
}
