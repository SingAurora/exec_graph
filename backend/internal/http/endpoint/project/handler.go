package project

import (
	"context"
	"errors"
	"net/http"

	applicationproject "github.com/singaurora/exec-graph/backend/internal/application/project"
	httprequest "github.com/singaurora/exec-graph/backend/internal/http/request"
	httpresponse "github.com/singaurora/exec-graph/backend/internal/http/response"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
)

// Handler 负责项目、项目状态和规则模板的 HTTP 适配。
type Handler struct {
	service *applicationproject.Service
}

// New 创建项目领域的 HTTP handler。
func New(service *applicationproject.Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) writeState(ctx context.Context, w http.ResponseWriter, userID uint64, projectUUID string, status int) error {
	state, err := h.service.GetProjectExecutionState(ctx, userID, projectUUID)
	if errors.Is(err, applicationproject.ErrNotFound) {
		return fault.New(fault.NotFound, "项目不存在")
	}
	if err != nil {
		return fault.Wrap(fault.Internal, "读取项目状态失败", err)
	}
	httpresponse.WriteJSON(w, status, state)
	return nil
}

func decodeJSON(r *http.Request, target any) error {
	if err := httprequest.DecodeJSON(r, target); err != nil {
		return fault.New(fault.InvalidRequest, "请求格式不正确")
	}
	return nil
}
