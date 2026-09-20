package middleware

import (
	"fmt"
	"log/slog"

	"github.com/gin-gonic/gin"
	httpresponse "github.com/singaurora/exec-graph/backend/internal/http/response"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
)

// ErrorBoundary 是 HTTP 层唯一的错误落点。
// endpoint 和认证 middleware 只向 Gin 上报错误，不在业务分支中写响应。
func ErrorBoundary(logger *slog.Logger) gin.HandlerFunc {
	return func(context *gin.Context) {
		defer func() {
			if recovered := recover(); recovered != nil {
				logger.ErrorContext(context.Request.Context(), "http panic recovered", "request_id", RequestIDFromContext(context), "panic", recovered)
				if !context.Writer.Written() {
					httpresponse.WriteFault(context.Writer, fault.Wrap(fault.Internal, "服务内部错误", fmt.Errorf("panic: %v", recovered)))
				}
				context.Abort()
			}
		}()

		context.Next()
		if len(context.Errors) == 0 || context.Writer.Written() {
			return
		}
		err := context.Errors.Last().Err
		logger.ErrorContext(context.Request.Context(), "http request failed", "request_id", RequestIDFromContext(context), "method", context.Request.Method, "path", context.Request.URL.Path, "error", err)
		httpresponse.WriteFault(context.Writer, err)
	}
}
