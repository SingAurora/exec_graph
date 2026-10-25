package bootstrap

import (
	"context"
	"log/slog"
	"net/http"

	appcatalogue "github.com/singaurora/exec-graph/backend/internal/application/catalogue"
	appidentity "github.com/singaurora/exec-graph/backend/internal/application/identity"
	httpcatalogue "github.com/singaurora/exec-graph/backend/internal/http/endpoint/catalogue"
	httpidentity "github.com/singaurora/exec-graph/backend/internal/http/endpoint/identity"
	"github.com/singaurora/exec-graph/backend/internal/http/router"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/catalogue"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/identity"
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
	return router.New(httpidentity.New(identityService, deps.Config.App.Environment == "production", int(deps.Config.App.SessionTTL().Seconds())), httpcatalogue.New(catalogueService, identityService, ready), deps.Config.App.AllowedOrigins, logger)
}
