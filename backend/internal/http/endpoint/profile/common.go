package profile

import (
	"context"
	"net/http"

	applicationidentity "github.com/singaurora/exec-graph/backend/internal/application/identity"
	applicationpublicprofile "github.com/singaurora/exec-graph/backend/internal/application/publicprofile"
	endpointcommon "github.com/singaurora/exec-graph/backend/internal/http/endpoint/common"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
)

type CacheSessionFunc func(context.Context, string, applicationidentity.User) error

// Handler 负责当前用户资料和媒体上传接口。
type Handler struct {
	identity      *applicationidentity.Service
	publicProfile *applicationpublicprofile.Service
	cacheSession  CacheSessionFunc
}

type Dependencies struct {
	Identity      *applicationidentity.Service
	PublicProfile *applicationpublicprofile.Service
	CacheSession  CacheSessionFunc
}

func New(dependencies Dependencies) *Handler {
	return &Handler{
		identity:      dependencies.Identity,
		publicProfile: dependencies.PublicProfile,
		cacheSession:  dependencies.CacheSession,
	}
}

func bindJSON(r *http.Request, target any) error {
	return endpointcommon.BindJSON(r, target)
}
func writeJSON(w http.ResponseWriter, status int, value any) {
	endpointcommon.WriteJSON(w, status, value)
}
func newHTTPError(status int, message string) error { return fault.FromHTTP(status, message) }
func bearerToken(r *http.Request) string            { return endpointcommon.BearerToken(r) }
func normalizeUserID(value string) (string, error) {
	return applicationidentity.NormalizeUserID(value)
}
