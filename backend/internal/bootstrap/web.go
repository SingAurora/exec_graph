package bootstrap

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/singaurora/exec-graph/backend/internal/bootstrap/config"
	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
	"golang.org/x/crypto/acme/autocert"
)

func webServers(app config.App, handler http.Handler) ([]*http.Server, error) {
	plain := webServer(app.Host, app.Port, handler)
	if !app.TLS.Enabled {
		return []*http.Server{plain}, nil
	}
	if err := os.MkdirAll(app.TLS.CacheDir, 0700); err != nil {
		return nil, fmt.Errorf("创建证书缓存目录: %w", err)
	}
	manager := &autocert.Manager{
		Prompt:     autocert.AcceptTOS,
		Cache:      autocert.DirCache(app.TLS.CacheDir),
		HostPolicy: autocert.HostWhitelist(app.TLS.Domains...),
	}
	// HTTP-01 验证不经过业务中间件；其余域名请求跳转，IP 保持原有 HTTP 访问。
	plain.Handler = manager.HTTPHandler(redirectDomains(app.TLS.Domains, handler))
	secure := webServer(app.Host, 443, handler)
	secure.TLSConfig = manager.TLSConfig()
	secure.TLSConfig.MinVersion = tls.VersionTLS12
	return []*http.Server{plain, secure}, nil
}

func webServer(host string, port int, handler http.Handler) *http.Server {
	return &http.Server{
		Addr:              net.JoinHostPort(host, strconv.Itoa(port)),
		Handler:           handler,
		ReadHeaderTimeout: constants.HTTPHeaderTimeout,
		ReadTimeout:       constants.HTTPRequestTimeout,
		WriteTimeout:      constants.AIRequestTimeout,
		IdleTimeout:       constants.HTTPRequestTimeout,
	}
}

func redirectDomains(domains []string, fallback http.Handler) http.Handler {
	allowed := make(map[string]bool, len(domains))
	for _, domain := range domains {
		allowed[domain] = true
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		host := r.Host
		if name, _, err := net.SplitHostPort(host); err == nil {
			host = name
		}
		host = strings.ToLower(strings.TrimSuffix(host, "."))
		if allowed[host] {
			target := *r.URL
			target.Scheme, target.Host, target.User = "https", host, nil
			http.Redirect(w, r, target.String(), http.StatusPermanentRedirect)
			return
		}
		if net.ParseIP(strings.Trim(host, "[]")) != nil {
			fallback.ServeHTTP(w, r)
			return
		}
		http.NotFound(w, r)
	})
}

func serveWeb(ctx context.Context, servers []*http.Server, logger *slog.Logger) error {
	// 所有端口先绑定成功再提供服务，避免其中一个端口被占用时留下半启动进程。
	listeners := make([]net.Listener, 0, len(servers))
	defer func() {
		for _, listener := range listeners {
			_ = listener.Close()
		}
	}()
	for _, server := range servers {
		listener, err := net.Listen("tcp", server.Addr)
		if err != nil {
			return fmt.Errorf("监听 %s: %w", server.Addr, err)
		}
		listeners = append(listeners, listener)
	}
	defer func() {
		for _, server := range servers {
			_ = server.Close()
		}
	}()
	failures := make(chan error, len(servers))
	for i, server := range servers {
		go func(server *http.Server, listener net.Listener) {
			logger.Info("引序服务启动", "address", listener.Addr(), "https", server.TLSConfig != nil)
			var err error
			if server.TLSConfig != nil {
				err = server.ServeTLS(listener, "", "")
			} else {
				err = server.Serve(listener)
			}
			failures <- err
		}(server, listeners[i])
	}
	select {
	case err := <-failures:
		if !errors.Is(err, http.ErrServerClosed) {
			return fmt.Errorf("运行 Web 服务: %w", err)
		}
	case <-ctx.Done():
	}
	shutdown, cancel := context.WithTimeout(context.Background(), constants.ShutdownTimeout)
	defer cancel()
	for _, server := range servers {
		if err := server.Shutdown(shutdown); err != nil {
			return fmt.Errorf("关闭 Web 服务: %w", err)
		}
	}
	return nil
}
