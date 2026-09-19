package middleware

import (
	"fmt"

	"github.com/gin-gonic/gin"
	httpresponse "github.com/singaurora/exec-graph/backend/internal/http/response"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
)

// ErrorBoundary 是 HTTP 层唯一的错误落点。
// endpoint 和认证 middleware 只向 Gin 上报错误，不在业务分支中写响应。
func ErrorBoundary() gin.HandlerFunc {
	return func(context *gin.Context) {
		defer func() {
			if recovered := recover(); recovered != nil {
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
		httpresponse.WriteFault(context.Writer, context.Errors.Last().Err)
	}
}
