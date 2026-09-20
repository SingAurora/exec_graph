package workflow

import (
	"net/http"

	applicationcollaboration "github.com/singaurora/exec-graph/backend/internal/application/collaboration"
	applicationconversation "github.com/singaurora/exec-graph/backend/internal/application/conversation"
	applicationreview "github.com/singaurora/exec-graph/backend/internal/application/review"
	applicationworkoverview "github.com/singaurora/exec-graph/backend/internal/application/workoverview"
	endpointcommon "github.com/singaurora/exec-graph/backend/internal/http/endpoint/common"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
)

// Handler 聚合规划、审查、协作和工作总览相关的 HTTP 适配逻辑。
type Handler struct {
	collaboration *applicationcollaboration.Service
	conversation  *applicationconversation.Service
	workOverview  *applicationworkoverview.Service
	reviewer      *applicationreview.Service
}

type Dependencies struct {
	Collaboration *applicationcollaboration.Service
	Conversation  *applicationconversation.Service
	WorkOverview  *applicationworkoverview.Service
	Reviewer      *applicationreview.Service
}

func New(dependencies Dependencies) *Handler {
	return &Handler{
		collaboration: dependencies.Collaboration,
		conversation:  dependencies.Conversation,
		workOverview:  dependencies.WorkOverview,
		reviewer:      dependencies.Reviewer,
	}
}

func bindJSON(r *http.Request, target any) error {
	return endpointcommon.BindJSON(r, target)
}
func writeJSON(w http.ResponseWriter, status int, value any) {
	endpointcommon.WriteJSON(w, status, value)
}
func newHTTPError(status int, message string) error { return fault.FromHTTP(status, message) }
