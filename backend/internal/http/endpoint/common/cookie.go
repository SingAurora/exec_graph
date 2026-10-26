package common

import (
	"github.com/gin-gonic/gin"
	"net/http"
)

// SetSessionCookie 统一会话策略；直接 TLS 请求始终启用 Secure，不信任代理头。
func SetSessionCookie(c *gin.Context, value string, maxAge int, secure bool) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie("exec_graph_v1_session", value, maxAge, "/api", "", secure || c.Request.TLS != nil, true)
}
