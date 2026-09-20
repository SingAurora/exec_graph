package middleware

import (
	"log/slog"
	"time"

	"github.com/gin-gonic/gin"
	sharedid "github.com/singaurora/exec-graph/backend/internal/shared/id"
)

const requestIDKey = "request_id"

// RequestID assigns a server-generated correlation ID to every request.
func RequestID() gin.HandlerFunc {
	return func(context *gin.Context) {
		requestID, err := sharedid.UUID()
		if err != nil {
			requestID = "unavailable"
		}
		context.Set(requestIDKey, requestID)
		context.Header("X-Request-ID", requestID)
		context.Next()
	}
}

// AccessLogger writes one structured completion event per HTTP request.
func AccessLogger(logger *slog.Logger) gin.HandlerFunc {
	return func(context *gin.Context) {
		startedAt := time.Now()
		context.Next()
		logger.InfoContext(context.Request.Context(), "http request completed",
			"request_id", RequestIDFromContext(context),
			"method", context.Request.Method,
			"path", context.Request.URL.Path,
			"route", context.FullPath(),
			"status", context.Writer.Status(),
			"duration_ms", time.Since(startedAt).Milliseconds(),
			"client_ip", context.ClientIP(),
		)
	}
}

// RequestIDFromContext reads the correlation ID assigned by RequestID.
func RequestIDFromContext(context *gin.Context) string {
	value, _ := context.Get(requestIDKey)
	requestID, _ := value.(string)
	return requestID
}
