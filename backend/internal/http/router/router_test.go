package router

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/singaurora/exec-graph/backend/internal/http/endpoint"
)

func TestRoutesRejectUnknownNestedPaths(t *testing.T) {
	router := New(endpoint.NewServer(endpoint.Dependencies{}).Endpoints())

	for _, path := range []string{
		"/api/commands/projects/get/extra",
		"/api/commands/contracts/delete/extra",
		"/api/commands/ai-keys/verify/extra",
		"/api/commands/conversations/send-message/extra",
	} {
		t.Run(path, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodGet, path, nil)
			response := httptest.NewRecorder()

			router.ServeHTTP(response, request)

			if response.Code != http.StatusNotFound {
				t.Fatalf("status = %d, want %d", response.Code, http.StatusNotFound)
			}
		})
	}
}

func TestReadCommandsUseGETAndRejectUnsupportedMethods(t *testing.T) {
	router := New(endpoint.NewServer(endpoint.Dependencies{}).Endpoints())
	readRequest := httptest.NewRequest(http.MethodGet, "/api/commands/projects/graph?projectId=project-1", nil)
	readResponse := httptest.NewRecorder()
	router.ServeHTTP(readResponse, readRequest)
	if readResponse.Code != http.StatusUnauthorized {
		t.Fatalf("GET status = %d, want %d", readResponse.Code, http.StatusUnauthorized)
	}

	for _, method := range []string{http.MethodPost, http.MethodPatch, http.MethodDelete} {
		t.Run(method, func(t *testing.T) {
			request := httptest.NewRequest(method, "/api/commands/projects/graph?projectId=project-1", nil)
			response := httptest.NewRecorder()

			router.ServeHTTP(response, request)

			if response.Code != http.StatusMethodNotAllowed {
				t.Fatalf("status = %d, want %d", response.Code, http.StatusMethodNotAllowed)
			}
		})
	}
}
