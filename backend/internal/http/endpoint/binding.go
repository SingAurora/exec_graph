package endpoint

import (
	"net/http"

	httprequest "github.com/singaurora/exec-graph/backend/internal/http/request"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
)

// decodeJSON 只负责解析请求，不写 HTTP 响应。解析失败由上层错误边界统一处理。
func decodeJSON(r *http.Request, target any) error {
	if err := httprequest.DecodeJSON(r, target); err != nil {
		return fault.New(fault.InvalidRequest, "请求格式不正确")
	}
	return nil
}

// bindJSON 是尚未迁移的旧 handler 兼容入口。新 handler 应使用 decodeJSON。
func bindJSON(w http.ResponseWriter, r *http.Request, target any) bool {
	if err := decodeJSON(r, target); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return false
	}
	return true
}
