package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
)

// CORS permits only explicitly configured browser origins.
func CORS(allowedOrigins []string) gin.HandlerFunc {
	allowed := make(map[string]struct{}, len(allowedOrigins))
	for _, origin := range allowedOrigins {
		allowed[origin] = struct{}{}
	}
	return func(context *gin.Context) {
		origin := context.GetHeader("Origin")
		if origin != "" {
			if _, ok := allowed[origin]; !ok {
				_ = context.Error(fault.New(fault.Forbidden, "当前来源不允许访问 API"))
				context.Abort()
				return
			}
			context.Header("Access-Control-Allow-Origin", origin)
			context.Header("Vary", "Origin")
		}
		context.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
		context.Header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		if context.Request.Method == http.MethodOptions {
			context.Status(http.StatusNoContent)
			context.Abort()
			return
		}
		context.Next()
	}
}
