package project

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
)

func TestGetProjectDetailReadsProjectUUIDOnlyFromQuery(t *testing.T) {
	handler := &Handler{}
	request := httptest.NewRequest(http.MethodGet, "/api/commands/projects/get-project-detail", strings.NewReader(`{"projectUuid":"550e8400-e29b-41d4-a716-446655440000"}`))

	err := handler.GetProjectDetail(httptest.NewRecorder(), request, 1)
	assertInvalidRequest(t, err, "缺少项目 UUID")
}

func TestUpdateProjectProfileReadsProjectUUIDOnlyFromJSON(t *testing.T) {
	handler := &Handler{}
	request := httptest.NewRequest(
		http.MethodPost,
		"/api/commands/projects/update-project-profile?projectUuid=550e8400-e29b-41d4-a716-446655440000",
		strings.NewReader(`{"title":"项目","description":"说明","visibility":"private"}`),
	)

	err := handler.UpdateProjectProfile(httptest.NewRecorder(), request, 1)
	assertInvalidRequest(t, err, "缺少项目 UUID")
}

func assertInvalidRequest(t *testing.T, err error, message string) {
	t.Helper()
	requestFault, ok := fault.As(err)
	if !ok {
		t.Fatalf("error = %v, want fault.Error", err)
	}
	if requestFault.Kind != fault.InvalidRequest || requestFault.Message != message {
		t.Fatalf("fault = %+v, want kind %q and message %q", requestFault, fault.InvalidRequest, message)
	}
}
