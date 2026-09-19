package response

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestWriteJSONUsesUnifiedEnvelope(t *testing.T) {
	recorder := httptest.NewRecorder()
	WriteJSON(recorder, http.StatusOK, map[string]string{"status": "ok"})

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
	}
	var envelope struct {
		Code int             `json:"code"`
		Msg  string          `json:"msg"`
		Data json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &envelope); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if envelope.Code != 0 || envelope.Msg != "success" || string(envelope.Data) != `{"status":"ok"}` {
		t.Fatalf("unexpected envelope: %+v, data=%s", envelope, envelope.Data)
	}
}

func TestWriteErrorUsesUnifiedEnvelope(t *testing.T) {
	recorder := httptest.NewRecorder()
	WriteError(recorder, http.StatusNotFound, "资源不存在")

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusNotFound)
	}
	var envelope Envelope
	if err := json.Unmarshal(recorder.Body.Bytes(), &envelope); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if envelope.Code != 40401 || envelope.Msg != "资源不存在" || envelope.Data != nil {
		t.Fatalf("unexpected envelope: %+v", envelope)
	}
}

func TestWriteJSONIncludesNullData(t *testing.T) {
	recorder := httptest.NewRecorder()
	WriteJSON(recorder, http.StatusOK, nil)

	if recorder.Body.String() != `{"code":0,"msg":"success","data":null}`+"\n" {
		t.Fatalf("body = %q", recorder.Body.String())
	}
}
