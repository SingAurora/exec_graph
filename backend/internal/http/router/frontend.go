package router

import (
	"errors"
	"io/fs"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/singaurora/exec-graph/backend/internal/http/endpoint/common"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
)

func frontendOrNotFound(files fs.FS) gin.HandlerFunc {
	var server http.Handler
	if files != nil {
		server = http.FileServer(http.FS(files))
	}
	return func(c *gin.Context) {
		name := strings.TrimPrefix(c.Request.URL.Path, "/")
		// API 保持原有 JSON 错误；不把未知接口或资源回退为首页。
		if server == nil || name == "api" || strings.HasPrefix(name, "api/") || (c.Request.Method != http.MethodGet && c.Request.Method != http.MethodHead) {
			common.Fail(c, fault.New(fault.NotFound, "接口不存在或尚未实现"))
			return
		}
		if name == "" {
			name = "index.html"
		}
		if !fs.ValidPath(name) || strings.Contains(name, "\\") {
			common.Fail(c, fault.New(fault.NotFound, "页面或资源不存在"))
			return
		}
		for _, part := range strings.Split(name, "/") {
			if strings.HasPrefix(part, ".") {
				common.Fail(c, fault.New(fault.NotFound, "页面或资源不存在"))
				return
			}
		}
		info, err := fs.Stat(files, name)
		if errors.Is(err, fs.ErrNotExist) || (err == nil && !info.Mode().IsRegular()) {
			common.Fail(c, fault.New(fault.NotFound, "页面或资源不存在"))
			return
		}
		if err != nil {
			common.Fail(c, err)
			return
		}
		// 首页和资源都重新验证缓存，避免部署更新后使用旧入口。
		c.Header("Cache-Control", "no-cache")
		server.ServeHTTP(c.Writer, c.Request)
	}
}
