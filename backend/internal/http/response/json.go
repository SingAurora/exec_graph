// Package response 输出统一的 HTTP JSON 响应。
package response

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
)

// Envelope 是所有 JSON API 的统一外层响应结构。
// HTTP 状态码表达传输层结果，Code 表达业务层结果，Data 承载具体业务数据。
type Envelope struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
	Data any    `json:"data"`
}

func WriteJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(Envelope{
		Code: 0,
		Msg:  "success",
		Data: value,
	})
}

func WriteError(w http.ResponseWriter, status int, message string) {
	writeEnvelope(w, status, businessCode(status), message, nil)
}

// WriteFault 将跨层错误转换为统一的 HTTP 响应。
// 未识别的错误只向客户端暴露通用消息，避免泄露数据库或外部服务细节。
func WriteFault(w http.ResponseWriter, err error) {
	var typed *fault.Error
	if errors.As(err, &typed) {
		status, code := faultResponse(typed.Kind)
		writeEnvelope(w, status, code, typed.Message, typed.Data)
		return
	}
	writeEnvelope(w, http.StatusInternalServerError, 50000, "服务内部错误", nil)
}

func writeEnvelope(w http.ResponseWriter, status, code int, message string, data any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(Envelope{Code: code, Msg: message, Data: data})
}

func faultResponse(kind fault.Kind) (int, int) {
	switch kind {
	case fault.InvalidRequest:
		return http.StatusBadRequest, 40001
	case fault.MethodNotAllowed:
		return http.StatusMethodNotAllowed, 40501
	case fault.Unauthenticated:
		return http.StatusUnauthorized, 40101
	case fault.Forbidden:
		return http.StatusForbidden, 40301
	case fault.NotFound:
		return http.StatusNotFound, 40401
	case fault.Conflict:
		return http.StatusConflict, 40901
	case fault.DependencyUnavailable:
		return http.StatusServiceUnavailable, 50301
	case fault.UpstreamFailure:
		return http.StatusBadGateway, 50201
	default:
		return http.StatusInternalServerError, 50000
	}
}

func businessCode(status int) int {
	switch status {
	case http.StatusBadRequest:
		return 40001
	case http.StatusMethodNotAllowed:
		return 40501
	case http.StatusUnauthorized:
		return 40101
	case http.StatusForbidden:
		return 40301
	case http.StatusNotFound:
		return 40401
	case http.StatusConflict:
		return 40901
	case http.StatusUnprocessableEntity:
		return 42201
	case http.StatusBadGateway:
		return 50201
	case http.StatusServiceUnavailable:
		return 50301
	default:
		return 50000
	}
}
