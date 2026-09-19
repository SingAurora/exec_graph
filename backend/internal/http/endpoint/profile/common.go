package profile

import (
	"context"
	"net/http"

	applicationidentity "github.com/singaurora/exec-graph/backend/internal/application/identity"
	endpointcommon "github.com/singaurora/exec-graph/backend/internal/http/endpoint/common"
	identitypersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/identity"
	infrastructurestorage "github.com/singaurora/exec-graph/backend/internal/infrastructure/storage"
)

type RequireUserFunc func(http.ResponseWriter, *http.Request) (applicationidentity.User, bool)
type CacheSessionFunc func(context.Context, string, applicationidentity.User) error

// Handler 负责当前用户资料和媒体上传接口。
type Handler struct {
	identityStore   identitypersistence.IdentityRepository
	storage         infrastructurestorage.ObjectStorage
	requireUserFunc RequireUserFunc
	cacheSession    CacheSessionFunc
}

type Dependencies struct {
	IdentityStore identitypersistence.IdentityRepository
	Storage       infrastructurestorage.ObjectStorage
	RequireUser   RequireUserFunc
	CacheSession  CacheSessionFunc
}

func New(dependencies Dependencies) *Handler {
	return &Handler{
		identityStore:   dependencies.IdentityStore,
		storage:         dependencies.Storage,
		requireUserFunc: dependencies.RequireUser,
		cacheSession:    dependencies.CacheSession,
	}
}

func (h *Handler) requireUser(w http.ResponseWriter, r *http.Request) (applicationidentity.User, bool) {
	return h.requireUserFunc(w, r)
}

func bindJSON(w http.ResponseWriter, r *http.Request, target any) bool {
	return endpointcommon.BindJSON(w, r, target)
}
func writeJSON(w http.ResponseWriter, status int, value any) {
	endpointcommon.WriteJSON(w, status, value)
}
func writeError(w http.ResponseWriter, status int, message string) {
	endpointcommon.WriteError(w, status, message)
}
func bearerToken(r *http.Request) string { return endpointcommon.BearerToken(r) }
func normalizeUserID(value string) (string, error) {
	return applicationidentity.NormalizeUserID(value)
}
