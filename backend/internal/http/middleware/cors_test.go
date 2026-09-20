package middleware

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestCORSAllowsConfiguredOriginAndRejectsOthers(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(RequestID(), ErrorBoundary(slog.New(slog.NewTextHandler(io.Discard, nil))), CORS([]string{"https://app.example.com"}))
	router.GET("/test", func(context *gin.Context) { context.Status(http.StatusNoContent) })

	allowed := httptest.NewRequest(http.MethodGet, "/test", nil)
	allowed.Header.Set("Origin", "https://app.example.com")
	allowedResponse := httptest.NewRecorder()
	router.ServeHTTP(allowedResponse, allowed)
	if allowedResponse.Code != http.StatusNoContent || allowedResponse.Header().Get("Access-Control-Allow-Origin") != "https://app.example.com" {
		t.Fatalf("allowed response = %d, origin %q", allowedResponse.Code, allowedResponse.Header().Get("Access-Control-Allow-Origin"))
	}

	blocked := httptest.NewRequest(http.MethodGet, "/test", nil)
	blocked.Header.Set("Origin", "https://attacker.example")
	blockedResponse := httptest.NewRecorder()
	router.ServeHTTP(blockedResponse, blocked)
	if blockedResponse.Code != http.StatusForbidden {
		t.Fatalf("blocked status = %d, want %d", blockedResponse.Code, http.StatusForbidden)
	}
}
