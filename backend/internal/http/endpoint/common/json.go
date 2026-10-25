// Package common 实现端点共享的请求与响应适配，不放领域业务。
package common

import (
	"encoding/json"
	"github.com/gin-gonic/gin"
	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
	"io"
	"mime"
	"net/http"
)

// Envelope 是业务协议的唯一 JSON 外壳。
type Envelope struct {
	Code    int    `json:"code"`
	Message string `json:"msg"`
	Data    any    `json:"data"`
}

// Reply 输出成功数据；领域 DTO 的内部主键不得到达这里。
func Reply(c *gin.Context, data any) { c.JSON(http.StatusOK, Envelope{Data: data}) }

// Fail 交给顶层错误边界统一映射，不重复写响应。
func Fail(c *gin.Context, err error) { _ = c.Error(err); c.Abort() }

// Bind 严格解析单份 JSON，拒绝未知字段及多余内容。
func Bind(c *gin.Context, input any) error {
	mediaType, _, err := mime.ParseMediaType(c.GetHeader("Content-Type"))
	if err != nil || mediaType != "application/json" {
		return fault.New(fault.Invalid, "请使用 JSON 提交请求")
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, constants.MaxJSONBytes)
	decoder := json.NewDecoder(c.Request.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(input); err != nil {
		return fault.New(fault.Invalid, "请求内容或字段不合法")
	}
	var extra json.RawMessage
	if err := decoder.Decode(&extra); err != io.EOF {
		return fault.New(fault.Invalid, "请求只能包含一份 JSON")
	}
	return nil
}

// Query 读取唯一必填查询参数，同时拒绝重复和未知参数。
func Query(c *gin.Context, name string) (string, error) {
	values := c.Request.URL.Query()
	if len(values) != 1 || len(values[name]) != 1 || values.Get(name) == "" {
		return "", fault.New(fault.Invalid, "查询参数不合法")
	}
	return values.Get(name), nil
}
