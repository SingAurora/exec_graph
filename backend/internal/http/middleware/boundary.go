// Package middleware 实现跨领域的 HTTP 边界。
package middleware

import (
	"errors"
	"github.com/gin-gonic/gin"
	"github.com/singaurora/exec-graph/backend/internal/http/endpoint/common"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
	"log/slog"
	"net/http"
)

// Boundary 生成请求编号并统一处理业务错误和未预期异常。
func Boundary(logger *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := id.New()
		c.Header("X-Request-Id", requestID)
		c.Header("Cache-Control", "no-store")
		defer func() {
			if recovered := recover(); recovered != nil {
				logger.Error("请求发生未预期异常", "request_id", requestID)
				c.Abort()
				_ = c.Error(fault.New(fault.Internal, "服务内部错误"))
			}
			if len(c.Errors) == 0 || c.Writer.Written() {
				return
			}
			err := c.Errors.Last().Err
			code, message := fault.Internal, "服务内部错误，请稍后重试"
			var known *fault.Error
			if errors.As(err, &known) {
				code, message = known.Code, known.Message
			} else {
				logger.Error("请求失败", "request_id", requestID, "error", err)
			}
			statuses := map[int]int{fault.Invalid: 400, fault.Unauthenticated: 401, fault.Forbidden: 403, fault.NotFound: 404, fault.Conflict: 409, fault.TooMany: 429, fault.Internal: 500, fault.Unavailable: 503}
			status := statuses[code]
			if status == 0 {
				status = http.StatusInternalServerError
			}
			c.JSON(status, common.Envelope{Code: code, Message: message, Data: nil})
		}()
		c.Next()
	}
}

// CORS 只接受明确列出的 Origin，携带 cookie 时不使用通配来源。
func CORS(origins []string) gin.HandlerFunc {
	allowed := map[string]bool{}
	for _, origin := range origins {
		allowed[origin] = true
	}
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin != "" {
			c.Header("Vary", "Origin")
			if !allowed[origin] {
				common.Fail(c, fault.New(fault.Forbidden, "请求来源不受信任"))
				return
			}
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Access-Control-Allow-Credentials", "true")
			c.Header("Access-Control-Expose-Headers", "X-Request-Id")
		}
		if c.Request.Method == http.MethodOptions {
			c.Header("Access-Control-Allow-Methods", "GET, POST")
			c.Header("Access-Control-Allow-Headers", "Content-Type, X-CSRF-Token, Idempotency-Key")
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}
