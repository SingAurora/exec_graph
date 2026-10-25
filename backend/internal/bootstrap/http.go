package bootstrap

import (
	"context"
	"log/slog"
	"net/http"

	appaction "github.com/singaurora/exec-graph/backend/internal/application/action"
	appcatalogue "github.com/singaurora/exec-graph/backend/internal/application/catalogue"
	appfollowing "github.com/singaurora/exec-graph/backend/internal/application/following"
	appgraph "github.com/singaurora/exec-graph/backend/internal/application/graph"
	appidentity "github.com/singaurora/exec-graph/backend/internal/application/identity"
	appprofile "github.com/singaurora/exec-graph/backend/internal/application/profile"
	httpaction "github.com/singaurora/exec-graph/backend/internal/http/endpoint/action"
	httpcatalogue "github.com/singaurora/exec-graph/backend/internal/http/endpoint/catalogue"
	httpfollowing "github.com/singaurora/exec-graph/backend/internal/http/endpoint/following"
	httpgraph "github.com/singaurora/exec-graph/backend/internal/http/endpoint/graph"
	httpidentity "github.com/singaurora/exec-graph/backend/internal/http/endpoint/identity"
	httpprofile "github.com/singaurora/exec-graph/backend/internal/http/endpoint/profile"
	"github.com/singaurora/exec-graph/backend/internal/http/router"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/action"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/catalogue"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/following"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/graph"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/identity"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/profile"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/security"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/storage/demomedia"
	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
)

// HTTP 装配已实现的读取和身份用例，不执行迁移或导入。
func HTTP(deps *Dependencies, logger *slog.Logger) http.Handler {
	catalogueRepository := catalogue.New(deps.DB)
	identityRepository := identity.New(deps.DB, catalogueRepository)
	identityService := appidentity.New(identityRepository, deps.Sessions, security.Passwords{}, deps.Config.App.SessionTTL(), deps.Config.App.EnableDemoLogin)
	catalogueService := appcatalogue.New(catalogueRepository, demomedia.Files{})
	ready := func(ctx context.Context) error {
		ctx, cancel := context.WithTimeout(ctx, constants.DependencyTimeout)
		defer cancel()
		pool, err := deps.DB.DB()
		if err != nil {
			return err
		}
		if err := pool.PingContext(ctx); err != nil {
			return err
		}
		return deps.Sessions.Ping(ctx)
	}
	return router.New(
		httpidentity.New(identityService, deps.Config.App.Environment == "production", int(deps.Config.App.SessionTTL().Seconds())),
		httpcatalogue.New(catalogueService, identityService, ready),
		httpgraph.New(appgraph.New(graph.New(deps.DB)), identityService),
		httpaction.New(appaction.New(action.New(deps.DB)), identityService),
		httpprofile.New(appprofile.New(profile.New(deps.DB)), identityService),
		httpfollowing.New(appfollowing.New(following.New(deps.DB)), identityService),
		deps.Config.App.AllowedOrigins, logger,
	)
}
