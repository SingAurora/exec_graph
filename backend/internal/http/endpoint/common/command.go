package common

import (
	"context"
	"github.com/gin-gonic/gin"
	"github.com/singaurora/exec-graph/backend/internal/application/identity"
	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
	"time"
)

// SessionToken 统一读取 HttpOnly 会话，不从业务 JSON 接受用户身份。
func SessionToken(c *gin.Context) string { value, _ := c.Cookie("exec_graph_v1_session"); return value }

// Command 统一进行身份、CSRF、JSON 适配，再调用创建用例。
func Command[I, O any](c *gin.Context, auth *identity.Service, run func(context.Context, identity.Actor, string, I) (O, error)) {
	CommandWithTimeout(c, auth, constants.HTTPRequestTimeout, run)
}

// CommandWithTimeout 为真实模型调用等明确的长请求复用同一认证和 JSON 边界。
func CommandWithTimeout[I, O any](c *gin.Context, auth *identity.Service, timeout time.Duration, run func(context.Context, identity.Actor, string, I) (O, error)) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), timeout)
	defer cancel()
	actor, err := auth.Authorize(ctx, SessionToken(c), c.GetHeader("X-CSRF-Token"))
	if err != nil {
		Fail(c, err)
		return
	}
	var input I
	if err := Bind(c, &input); err != nil {
		Fail(c, err)
		return
	}
	out, err := run(ctx, actor, c.GetHeader("Idempotency-Key"), input)
	if err != nil {
		Fail(c, err)
		return
	}
	Reply(c, out)
}

// Mutation 复用相同的边界处理，修改用例通过 expectedVersion 控制并发。
func Mutation[I, O any](c *gin.Context, auth *identity.Service, run func(context.Context, identity.Actor, I) (O, error)) {
	Command(c, auth, func(ctx context.Context, actor identity.Actor, _ string, input I) (O, error) {
		return run(ctx, actor, input)
	})
}
