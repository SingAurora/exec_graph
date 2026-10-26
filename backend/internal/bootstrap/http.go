package bootstrap

import (
	"context"
	"log/slog"
	"net/http"

	appaccount "github.com/singaurora/exec-graph/backend/internal/application/account"
	appaction "github.com/singaurora/exec-graph/backend/internal/application/action"
	appcatalogue "github.com/singaurora/exec-graph/backend/internal/application/catalogue"
	appfollowing "github.com/singaurora/exec-graph/backend/internal/application/following"
	appgeneration "github.com/singaurora/exec-graph/backend/internal/application/generation"
	appgraph "github.com/singaurora/exec-graph/backend/internal/application/graph"
	appidentity "github.com/singaurora/exec-graph/backend/internal/application/identity"
	appmedia "github.com/singaurora/exec-graph/backend/internal/application/media"
	appprofile "github.com/singaurora/exec-graph/backend/internal/application/profile"
	httpaccount "github.com/singaurora/exec-graph/backend/internal/http/endpoint/account"
	httpaction "github.com/singaurora/exec-graph/backend/internal/http/endpoint/action"
	httpcatalogue "github.com/singaurora/exec-graph/backend/internal/http/endpoint/catalogue"
	httpfollowing "github.com/singaurora/exec-graph/backend/internal/http/endpoint/following"
	httpgeneration "github.com/singaurora/exec-graph/backend/internal/http/endpoint/generation"
	httpgraph "github.com/singaurora/exec-graph/backend/internal/http/endpoint/graph"
	httpidentity "github.com/singaurora/exec-graph/backend/internal/http/endpoint/identity"
	httpmedia "github.com/singaurora/exec-graph/backend/internal/http/endpoint/media"
	httpprofile "github.com/singaurora/exec-graph/backend/internal/http/endpoint/profile"
	"github.com/singaurora/exec-graph/backend/internal/http/router"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/ai"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/mail"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/account"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/action"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/catalogue"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/following"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/generation"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/graph"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/identity"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/media"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/profile"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/security"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/storage"
	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
	"time"
)

// HTTP 装配已实现的读取和身份用例，不执行迁移或导入。
func HTTP(deps *Dependencies, logger *slog.Logger) http.Handler {
	catalogueRepository := catalogue.New(deps.DB)
	identityRepository := identity.New(deps.DB, catalogueRepository)
	identityService := appidentity.New(identityRepository, deps.Sessions, security.Passwords{}, deps.Config.App.SessionTTL(), deps.Config.App.EnableDemoLogin)
	catalogueService := appcatalogue.New(catalogueRepository)
	objects := deps.Objects
	if objects == nil {
		// 测试可只装配数据库依赖；未注入云客户端时显式禁用真实上传。
		objects = storage.Disabled()
	}
	provider := deps.AI
	if provider == nil {
		provider = ai.Disabled()
	}
	sender := deps.Mail
	if sender == nil {
		sender = mail.Disabled()
	}
	codeTTL := time.Duration(deps.Config.Mail.CodeTTLMinutes) * time.Minute
	if codeTTL == 0 {
		codeTTL = constants.DefaultCodeTTL
	}
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
		httpmedia.New(appmedia.New(media.New(deps.DB), objects, mediaLimits(deps.Config)), identityService),
		httpgeneration.New(appgeneration.New(generation.New(deps.DB), provider, generationLimits(deps.Config)), identityService),
		httpaccount.New(appaccount.New(account.New(deps.DB, identityRepository), deps.Sessions, sender, security.Passwords{}, identityService, codeTTL), identityService, deps.Config.App.Environment == "production", int(deps.Config.App.SessionTTL().Seconds())),
		deps.Config.App.AllowedOrigins, logger, deps.Frontend,
	)
}
