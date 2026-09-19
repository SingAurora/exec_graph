// Package fault 定义跨层传递的业务错误。
// 它只描述错误语义，不依赖 HTTP 状态码，HTTP 层再负责转换为 API 响应。
package fault

import (
	"errors"
	"net/http"
)

type Kind string

const (
	InvalidRequest        Kind = "invalid_request"
	MethodNotAllowed      Kind = "method_not_allowed"
	Unauthenticated       Kind = "unauthenticated"
	Forbidden             Kind = "forbidden"
	NotFound              Kind = "not_found"
	Conflict              Kind = "conflict"
	DependencyUnavailable Kind = "dependency_unavailable"
	UpstreamFailure       Kind = "upstream_failure"
	Internal              Kind = "internal"
)

// Error 是跨 application、HTTP middleware 和 endpoint 的统一错误载体。
// Cause 只用于日志和 errors.Is/errors.As，不应直接暴露给客户端。
type Error struct {
	Kind    Kind
	Message string
	Cause   error
	Data    any
}

func (e *Error) Error() string {
	if e == nil {
		return ""
	}
	if e.Message != "" {
		return e.Message
	}
	if e.Cause != nil {
		return e.Cause.Error()
	}
	return string(e.Kind)
}

func (e *Error) Unwrap() error { return e.Cause }

func New(kind Kind, message string) error {
	return &Error{Kind: kind, Message: message}
}

func Wrap(kind Kind, message string, cause error) error {
	return &Error{Kind: kind, Message: message, Cause: cause}
}

func WithData(kind Kind, message string, data any) error {
	return &Error{Kind: kind, Message: message, Data: data}
}

func As(err error) (*Error, bool) {
	var target *Error
	return target, errors.As(err, &target)
}

// FromHTTP 兼容尚未完成迁移的 HTTP handler，将旧式状态码转换为跨层错误。
func FromHTTP(status int, message string) error {
	kind := Internal
	switch status {
	case http.StatusBadRequest:
		kind = InvalidRequest
	case http.StatusMethodNotAllowed:
		kind = MethodNotAllowed
	case http.StatusUnauthorized:
		kind = Unauthenticated
	case http.StatusForbidden:
		kind = Forbidden
	case http.StatusNotFound:
		kind = NotFound
	case http.StatusConflict:
		kind = Conflict
	case http.StatusUnprocessableEntity:
		kind = InvalidRequest
	case http.StatusBadGateway:
		kind = UpstreamFailure
	case http.StatusServiceUnavailable:
		kind = DependencyUnavailable
	}
	return New(kind, message)
}
