package network

import (
	"context"
	"net/http"

	applicationnetwork "github.com/singaurora/exec-graph/backend/internal/application/network"
	httpresponse "github.com/singaurora/exec-graph/backend/internal/http/response"
	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
)

// Handler 负责探索页执行网络的 HTTP 适配。
type Handler struct {
	service *applicationnetwork.Service
}

func New(service *applicationnetwork.Service) *Handler {
	return &Handler{service: service}
}

// GetPublicCollaborationNetwork 返回公开项目、成果和参与者组成的协作网络。
func (h *Handler) GetPublicCollaborationNetwork(w http.ResponseWriter, r *http.Request, currentUserID *uint64) error {
	ctx, cancel := context.WithTimeout(r.Context(), sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	graph, err := h.service.GetPublicCollaborationNetwork(ctx, currentUserID)
	if err != nil {
		return fault.Wrap(fault.Internal, "读取执行网络失败", err)
	}
	httpresponse.WriteJSON(w, http.StatusOK, graph)
	return nil
}
