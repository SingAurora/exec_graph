package common

import (
	"github.com/gin-gonic/gin"
	"net/http"
)

// SetSessionCookie 统一当前版本会话的路径、HttpOnly 和 SameSite 策略。
func SetSessionCookie(c *gin.Context, value string, maxAge int, secure bool) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie("exec_graph_v1_session", value, maxAge, "/api", "", secure, true)
}
