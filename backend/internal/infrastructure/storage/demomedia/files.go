// Package demomedia 提供明确导入到测试账号的内置配图，不作为真实上传的回退。
package demomedia

import (
	"context"
	"embed"
	"fmt"
	"path"
	"strings"
)

//go:embed assets/*
var images embed.FS

// Files 只提供 demo/v1 命名空间下的内置测试图片。
type Files struct{}

// Read 验证对象键后读取，禁止任意本地文件或外链抓取。
func (Files) Read(ctx context.Context, key string) ([]byte, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	name := strings.TrimPrefix(key, "demo/v1/")
	if !strings.HasPrefix(key, "demo/v1/") || name == "" || path.Base(name) != name {
		return nil, fmt.Errorf("当前文件存储不支持此对象")
	}
	body, err := images.ReadFile("assets/" + name)
	if err != nil {
		return nil, fmt.Errorf("读取演示文件: %w", err)
	}
	return body, nil
}
