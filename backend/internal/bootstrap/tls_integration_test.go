package bootstrap

import (
	"log/slog"
	"net/http/httptest"
	"testing"
)

func TestRealHTTPSBearerSessionAndLogout(t *testing.T) {
	s := writeFixture(t)
	server := httptest.NewTLSServer(HTTP(s.deps, slog.New(slog.NewTextHandler(nil, nil))))
	defer server.Close()
	login := authRequest(t, writeClient{url: server.URL, http: server.Client()}, "auth/demo-login", struct{}{}, 200)
	login.call(t, "GET", "auth/session", nil, 200, "")
	login.call(t, "POST", "auth/logout", struct{}{}, 200, "")
	login.call(t, "GET", "auth/session", nil, 401, "")
}
