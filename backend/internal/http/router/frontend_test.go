package router

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"
	"time"

	"github.com/singaurora/exec-graph/backend/internal/http/endpoint/catalogue"
	"github.com/singaurora/exec-graph/backend/internal/http/endpoint/common"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
)

func TestFrontendAndAPIRouting(t *testing.T) {
	modified := time.Date(2026, 10, 26, 0, 0, 0, 0, time.UTC)
	files := fstest.MapFS{
		"index.html":                          {Data: []byte("<!doctype html><title>引序</title>"), ModTime: modified},
		"assets/app-123.js":                   {Data: []byte("console.log('app')"), ModTime: modified},
		"assets/app-123.css":                  {Data: []byte("body { color: black; }")},
		"favicon.svg":                         {Data: []byte("<svg></svg>")},
		".env":                                {Data: []byte("secret")},
		"assets/.hidden":                      {Data: []byte("secret")},
		"api/commands/system/health":          {Data: []byte("must not shadow API")},
		"api/commands/not-implemented/detail": {Data: []byte("must not shadow API")},
	}
	read := catalogue.New(nil, nil, func(context.Context) error { return nil })
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	engine := New(nil, read, nil, nil, nil, nil, nil, nil, nil, []string{"http://example.test"}, logger, files)
	for _, tc := range []struct {
		name, method, path, contentType, body string
		status                                int
	}{
		{"首页", "GET", "/", "text/html", "<title>引序</title>", 200},
		{"hash 路由的文档请求", "GET", "/?projectId=cooking", "text/html", "<title>引序</title>", 200},
		{"脚本", "GET", "/assets/app-123.js", "javascript", "console.log('app')", 200},
		{"样式", "GET", "/assets/app-123.css", "text/css", "body", 200},
		{"根目录公共资源", "GET", "/favicon.svg", "image/svg+xml", "<svg>", 200},
		{"HEAD", "HEAD", "/assets/app-123.js", "javascript", "", 200},
		{"真实 API 优先", "GET", "/api/commands/system/health", "application/json", `"code":0`, 200},
		{"未知 API", "GET", "/api/commands/not-implemented/detail", "application/json", "", 404},
		{"API 错误方法", "POST", "/api/commands/system/health", "application/json", "", 404},
		{"API 前缀", "GET", "/api", "application/json", "", 404},
		{"资源缺失", "GET", "/assets/missing.js", "application/json", "", 404},
		{"不回退首页", "GET", "/project", "application/json", "", 404},
		{"目录禁止列举", "GET", "/assets", "application/json", "", 404},
		{"目录带斜线", "GET", "/assets/", "application/json", "", 404},
		{"隐藏文件", "GET", "/.env", "application/json", "", 404},
		{"嵌套隐藏文件", "GET", "/assets/.hidden", "application/json", "", 404},
		{"路径穿越", "GET", "/assets/../../etc/config.local.yaml", "application/json", "", 404},
		{"编码路径穿越", "GET", "/%2e%2e/etc/config.local.yaml", "application/json", "", 404},
		{"反斜线", "GET", "/assets%5capp-123.js", "application/json", "", 404},
		{"资源不能写入", "POST", "/assets/app-123.js", "application/json", "", 404},
	} {
		t.Run(tc.name, func(t *testing.T) {
			r := httptest.NewRecorder()
			engine.ServeHTTP(r, httptest.NewRequest(tc.method, tc.path, nil))
			if r.Code != tc.status || !strings.Contains(r.Header().Get("Content-Type"), tc.contentType) || !strings.Contains(r.Body.String(), tc.body) {
				t.Fatalf("响应不符: status=%d headers=%v body=%s", r.Code, r.Header(), r.Body.String())
			}
			if tc.method == "HEAD" && r.Body.Len() != 0 {
				t.Fatal("HEAD 不应返回文件正文")
			}
			if tc.status == 404 {
				var envelope common.Envelope
				if err := json.Unmarshal(r.Body.Bytes(), &envelope); err != nil || envelope.Code != fault.NotFound {
					t.Fatalf("404 未保留统一错误协议: %s", r.Body.String())
				}
			}
		})
	}
	request := httptest.NewRequest("GET", "/assets/app-123.js", nil)
	request.Header.Set("If-Modified-Since", modified.Format(http.TimeFormat))
	r := httptest.NewRecorder()
	engine.ServeHTTP(r, request)
	if r.Code != http.StatusNotModified || r.Header().Get("Cache-Control") != "no-cache" || r.Body.Len() != 0 {
		t.Fatalf("资源条件缓存不正确: %d %v %s", r.Code, r.Header(), r.Body.String())
	}

	apiOnly := New(nil, read, nil, nil, nil, nil, nil, nil, nil, nil, logger, nil)
	r = httptest.NewRecorder()
	apiOnly.ServeHTTP(r, httptest.NewRequest("GET", "/", nil))
	if r.Code != http.StatusNotFound {
		t.Fatalf("未配置前端时应保持 API 模式: %d", r.Code)
	}
}
