package endpoint

import (
	"net/http"

	httpresponse "github.com/singaurora/exec-graph/backend/internal/http/response"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
)

type faultCapturingWriter struct {
	http.ResponseWriter
	err error
}

func (writer *faultCapturingWriter) captureFault(err error) {
	if writer.err == nil {
		writer.err = err
	}
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	httpresponse.WriteJSON(w, status, value)
}

func writeError(w http.ResponseWriter, status int, message string) {
	if writer, ok := w.(*faultCapturingWriter); ok {
		writer.captureFault(fault.FromHTTP(status, message))
		return
	}
	httpresponse.WriteError(w, status, message)
}

func writeFault(w http.ResponseWriter, err error) {
	httpresponse.WriteFault(w, err)
}
