package router

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/singaurora/exec-graph/backend/internal/http/endpoint"
)

func TestRoutesRejectUnknownNestedPaths(t *testing.T) {
	router := New(endpoint.NewServer(endpoint.Dependencies{}).Endpoints(), Config{AllowedOrigins: []string{"http://localhost:5173"}})

	for _, path := range []string{
		"/api/commands/projects/get-project-detail/extra",
		"/api/commands/contracts/delete-smart-contract/extra",
		"/api/commands/ai-keys/verify-saved-ai-key/extra",
		"/api/commands/conversations/send-conversation-message/extra",
	} {
		t.Run(path, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodGet, path, nil)
			response := httptest.NewRecorder()

			router.ServeHTTP(response, request)

			if response.Code != http.StatusNotFound {
				t.Fatalf("status = %d, want %d", response.Code, http.StatusNotFound)
			}
			var body struct {
				Code int    `json:"code"`
				Msg  string `json:"msg"`
			}
			if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
				t.Fatalf("decode error response: %v", err)
			}
			if body.Code != 40401 || body.Msg != "接口不存在" {
				t.Fatalf("unexpected error response: %+v", body)
			}
		})
	}
}

func TestReadCommandsUseGETAndRejectUnsupportedMethods(t *testing.T) {
	router := New(endpoint.NewServer(endpoint.Dependencies{}).Endpoints(), Config{AllowedOrigins: []string{"http://localhost:5173"}})
	readRequest := httptest.NewRequest(http.MethodGet, "/api/commands/projects/get-project-execution-graph?projectUuid=550e8400-e29b-41d4-a716-446655440000", nil)
	readResponse := httptest.NewRecorder()
	router.ServeHTTP(readResponse, readRequest)
	if readResponse.Code != http.StatusUnauthorized {
		t.Fatalf("GET status = %d, want %d", readResponse.Code, http.StatusUnauthorized)
	}

	for _, method := range []string{http.MethodPost, http.MethodPatch, http.MethodDelete} {
		t.Run(method, func(t *testing.T) {
			request := httptest.NewRequest(method, "/api/commands/projects/get-project-execution-graph?projectUuid=550e8400-e29b-41d4-a716-446655440000", nil)
			response := httptest.NewRecorder()

			router.ServeHTTP(response, request)

			if response.Code != http.StatusMethodNotAllowed {
				t.Fatalf("status = %d, want %d", response.Code, http.StatusMethodNotAllowed)
			}
		})
	}
}

func TestPublicProfileRouteUsesGETWithoutAuthentication(t *testing.T) {
	endpoints := endpoint.NewServer(endpoint.Dependencies{}).Endpoints()
	endpoints.GetPublicUserProfile = func(context *gin.Context) {
		context.Status(http.StatusNoContent)
	}
	router := New(endpoints, Config{AllowedOrigins: []string{"http://localhost:5173"}})

	request := httptest.NewRequest(http.MethodGet, "/api/commands/explore/get-public-user-profile?userId=linzhou", nil)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusNoContent {
		t.Fatalf("GET status = %d, want %d", response.Code, http.StatusNoContent)
	}

	postRequest := httptest.NewRequest(http.MethodPost, "/api/commands/explore/get-public-user-profile", nil)
	postResponse := httptest.NewRecorder()
	router.ServeHTTP(postResponse, postRequest)
	if postResponse.Code != http.StatusMethodNotAllowed {
		t.Fatalf("POST status = %d, want %d", postResponse.Code, http.StatusMethodNotAllowed)
	}
}
