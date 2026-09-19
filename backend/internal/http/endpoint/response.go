package endpoint

import (
	"net/http"

	httpresponse "github.com/singaurora/exec-graph/backend/internal/http/response"
)

func writeJSON(w http.ResponseWriter, status int, value any) {
	httpresponse.WriteJSON(w, status, value)
}

func writeError(w http.ResponseWriter, status int, message string) {
	httpresponse.WriteError(w, status, message)
}
