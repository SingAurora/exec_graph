package bootstrap

import (
	"fmt"
	"io/fs"
	"os"
)

// frontendFiles 只开放显式指定的构建目录；开发时留空仍然只提供 API。
func frontendFiles(directory string) (fs.FS, error) {
	if directory == "" {
		return nil, nil
	}
	files := os.DirFS(directory)
	index, err := files.Open("index.html")
	if err != nil {
		return nil, fmt.Errorf("读取前端构建入口失败，请先构建前端并检查 app.frontend_dir: %w", err)
	}
	defer index.Close()
	info, err := index.Stat()
	if err != nil {
		return nil, fmt.Errorf("检查前端构建入口失败: %w", err)
	}
	if !info.Mode().IsRegular() {
		return nil, fmt.Errorf("前端构建入口 index.html 必须是普通文件")
	}
	return files, nil
}
