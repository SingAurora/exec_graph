package endpoint

import (
	"context"
	"net/http"

	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
)

// handleExploreNetwork only translates HTTP context into the network read use case.
func (s *Server) handleExploreNetwork(w http.ResponseWriter, r *http.Request) {
	user, authenticated := s.optionalUser(r)
	var currentUserID *uint64
	if authenticated {
		currentUserID = &user.ID
	}
	ctx, cancel := context.WithTimeout(r.Context(), sharedconstants.DatabaseOperationTimeout)
	defer cancel()
	graph, err := s.network.Explore(ctx, currentUserID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取执行网络失败")
		return
	}
	writeJSON(w, http.StatusOK, graph)
}
