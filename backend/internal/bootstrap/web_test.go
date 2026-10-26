package bootstrap

import (
	"context"
	"crypto/tls"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/singaurora/exec-graph/backend/internal/bootstrap/config"
	"golang.org/x/crypto/acme"
	"golang.org/x/crypto/acme/autocert"
)

func TestHTTPDomainRedirectAndIPAccess(t *testing.T) {
	handler := redirectDomains([]string{"yinxu.fun", "www.yinxu.fun"}, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusAccepted)
	}))
	for _, test := range []struct {
		url      string
		status   int
		location string
	}{
		{"http://yinxu.fun/", 308, "https://yinxu.fun/"},
		{"http://www.yinxu.fun/api/commands/auth/login?a=b%20c", 308, "https://www.yinxu.fun/api/commands/auth/login?a=b%20c"},
		{"http://YINXU.FUN:80/a%2Fb", 308, "https://yinxu.fun/a%2Fb"},
		{"http://115.159.206.123/", 202, ""},
		{"http://127.0.0.1/api/commands/system/health", 202, ""},
		{"http://[::1]/", 202, ""},
		{"http://untrusted.example/", 404, ""},
		{"http://yinxu.fun.evil.example/", 404, ""},
	} {
		for _, method := range []string{"GET", "HEAD", "POST"} {
			t.Run(method+" "+test.url, func(t *testing.T) {
				w := httptest.NewRecorder()
				handler.ServeHTTP(w, httptest.NewRequest(method, test.url, nil))
				if w.Code != test.status || w.Header().Get("Location") != test.location {
					t.Fatalf("HTTP %d Location=%q", w.Code, w.Header().Get("Location"))
				}
			})
		}
	}
}

func TestWebServersACMEAndHTTPCompatibility(t *testing.T) {
	fallback := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(202) })
	app := config.App{Host: "127.0.0.1", Port: 8081}
	servers, err := webServers(app, fallback)
	if err != nil || len(servers) != 1 || servers[0].TLSConfig != nil {
		t.Fatalf("关闭 TLS 应保留 HTTP: %v", err)
	}
	app.Port = 80
	app.TLS = config.TLS{Enabled: true, Domains: []string{"yinxu.fun", "www.yinxu.fun"}, CacheDir: filepath.Join(t.TempDir(), "certs")}
	servers, err = webServers(app, fallback)
	if err != nil {
		t.Fatal(err)
	}
	if len(servers) != 2 || servers[1].Addr != "127.0.0.1:443" || servers[1].TLSConfig.MinVersion < tls.VersionTLS12 {
		t.Fatal("HTTPS 未正确装配")
	}
	alpn := false
	for _, protocol := range servers[1].TLSConfig.NextProtos {
		alpn = alpn || protocol == acme.ALPNProto
	}
	if !alpn {
		t.Fatal("证书验证所需 TLS ALPN 丢失")
	}
	// 用真实 DirCache 模拟 HTTP-01 验证令牌，保证重启后仍从持久缓存读取。
	cache := autocert.DirCache(app.TLS.CacheDir)
	if err := cache.Put(context.Background(), "test-token+http-01", []byte("challenge-response")); err != nil {
		t.Fatal(err)
	}
	for _, domain := range []string{"yinxu.fun", "www.yinxu.fun"} {
		w := httptest.NewRecorder()
		servers[0].Handler.ServeHTTP(w, httptest.NewRequest("GET", "http://"+domain+"/.well-known/acme-challenge/test-token", nil))
		if w.Code != 200 || w.Body.String() != "challenge-response" || w.Header().Get("Location") != "" {
			t.Fatalf("ACME 验证被业务处理或跳转: %d %q", w.Code, w.Body.String())
		}
	}
	w := httptest.NewRecorder()
	servers[0].Handler.ServeHTTP(w, httptest.NewRequest("GET", "http://untrusted.example/.well-known/acme-challenge/test-token", nil))
	if w.Code != 403 {
		t.Fatal("未配置域名不应通过 ACME 验证")
	}
	if _, err := servers[1].TLSConfig.GetCertificate(&tls.ClientHelloInfo{ServerName: "untrusted.example"}); err == nil {
		t.Fatal("未配置域名不应触发证书签发")
	}
}

func TestWebBindFailureReleasesOtherPort(t *testing.T) {
	first, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	address := first.Addr().String()
	if err := first.Close(); err != nil {
		t.Fatal(err)
	}
	occupied, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer occupied.Close()
	servers := []*http.Server{{Addr: address}, {Addr: occupied.Addr().String()}}
	err = serveWeb(context.Background(), servers, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err == nil {
		t.Fatal("端口已占用必须启动失败")
	}
	reused, err := net.Listen("tcp", address)
	if err != nil {
		t.Fatal("启动失败后第一个端口未释放", err)
	}
	_ = reused.Close()
}
