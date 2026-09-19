package endpoint

import (
	"net/http"

	httprequest "github.com/singaurora/exec-graph/backend/internal/http/request"
)

// bindJSON 将公共请求解析错误转换为本 API 的统一 HTTP 错误响应。
// 字段必填、格式和业务约束仍由调用它的 endpoint 校验。
func bindJSON(w http.ResponseWriter, r *http.Request, target any) bool {
	if err := httprequest.DecodeJSON(r, target); err != nil {
		writeError(w, http.StatusBadRequest, "请求格式不正确")
		return false
	}
	return true
}
