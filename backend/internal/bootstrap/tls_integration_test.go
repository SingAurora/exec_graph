package bootstrap

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/singaurora/exec-graph/backend/internal/application/identity"
)

func TestRealHTTPSCookieSessionAndLogout(t *testing.T) {
	s := writeFixture(t)
	server := httptest.NewTLSServer(HTTP(s.deps, slog.New(slog.NewTextHandler(io.Discard, nil))))
	defer server.Close()
	client := server.Client()
	jar, err := cookiejar.New(nil)
	if err != nil {
		t.Fatal(err)
	}
	client.Jar = jar
	login := authRequest(t, writeClient{url: server.URL, http: client}, "auth/demo-login", struct{}{}, 200)
	// 后续请求仅依赖浏览器等价的 CookieJar，不手动补入会话 Cookie。
	response, err := client.Get(server.URL + "/api/commands/auth/session")
	if err != nil {
		t.Fatal(err)
	}
	var session wire[identity.SessionView]
	err = json.NewDecoder(response.Body).Decode(&session)
	response.Body.Close()
	if err != nil || response.StatusCode != 200 || session.Data.CSRFToken != login.csrf {
		t.Fatalf("HTTPS Cookie 会话未保持: HTTP %d, %v", response.StatusCode, err)
	}
	request, err := http.NewRequest("POST", server.URL+"/api/commands/auth/logout", strings.NewReader("{}"))
	if err != nil {
		t.Fatal(err)
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-CSRF-Token", session.Data.CSRFToken)
	response, err = client.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	response.Body.Close()
	if response.StatusCode != 200 {
		t.Fatalf("HTTPS 退出失败: HTTP %d", response.StatusCode)
	}
	response, err = client.Get(server.URL + "/api/commands/auth/session")
	if err != nil {
		t.Fatal(err)
	}
	response.Body.Close()
	if response.StatusCode != 401 {
		t.Fatal("退出后会话仍有效")
	}
}
