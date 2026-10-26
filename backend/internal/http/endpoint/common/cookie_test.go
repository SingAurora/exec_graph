package common

import (
	"crypto/tls"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestSessionCookieTransportPolicy(t *testing.T) {
	for _, test := range []struct {
		name, forwardedProto string
		production, tls      bool
		wantSecure           bool
	}{
		{name: "http_ip"},
		{name: "direct_https", tls: true, wantSecure: true},
		{name: "production", production: true, wantSecure: true},
		{name: "forged_proxy_header", forwardedProto: "https"},
	} {
		for _, maxAge := range []int{3600, -1} {
			t.Run(test.name, func(t *testing.T) {
				w := httptest.NewRecorder()
				c, _ := gin.CreateTestContext(w)
				c.Request = httptest.NewRequest("POST", "http://example.com/api/commands/auth/login", nil)
				c.Request.Header.Set("X-Forwarded-Proto", test.forwardedProto)
				if test.tls {
					c.Request.TLS = &tls.ConnectionState{}
				}
				SetSessionCookie(c, "test-session", maxAge, test.production)
				cookies := w.Result().Cookies()
				if len(cookies) != 1 {
					t.Fatal("未返回会话 Cookie")
				}
				cookie := cookies[0]
				if cookie.Secure != test.wantSecure || !cookie.HttpOnly || cookie.Path != "/api" || cookie.SameSite != http.SameSiteLaxMode || cookie.Domain != "" || cookie.MaxAge != maxAge {
					t.Fatalf("会话 Cookie 策略错误: %+v", cookie)
				}
			})
		}
	}
}
