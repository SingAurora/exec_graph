// Package fault 定义与 HTTP 无关的业务错误。
package fault

// Error 是可以向用户展示的业务失败。
type Error struct {
	Code    int
	Message string
}

// Error 实现标准错误接口。
func (e *Error) Error() string { return e.Message }

// New 构造已知业务错误，HTTP 层统一映射状态码。
func New(code int, message string) error { return &Error{Code: code, Message: message} }

const (
	// Invalid 表示参数不合法。
	Invalid = 10001
	// Unauthenticated 表示未登录或会话失效。
	Unauthenticated = 10002
	// Forbidden 表示没有操作权限。
	Forbidden = 10003
	// NotFound 表示资源不存在。
	NotFound = 10004
	// Conflict 表示版本或状态冲突。
	Conflict = 10005
	// TooMany 表示触发频率限制。
	TooMany = 10006
	// Internal 表示非预期内部错误。
	Internal = 10007
	// Unavailable 表示依赖暂不可用。
	Unavailable = 10008
)
