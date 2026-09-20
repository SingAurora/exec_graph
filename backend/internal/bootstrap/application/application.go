package application

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	applicationaikey "github.com/singaurora/exec-graph/backend/internal/application/aikey"
	applicationcollaboration "github.com/singaurora/exec-graph/backend/internal/application/collaboration"
	applicationconversation "github.com/singaurora/exec-graph/backend/internal/application/conversation"
	applicationidentity "github.com/singaurora/exec-graph/backend/internal/application/identity"
	applicationnetwork "github.com/singaurora/exec-graph/backend/internal/application/network"
	applicationproject "github.com/singaurora/exec-graph/backend/internal/application/project"
	applicationpublicprofile "github.com/singaurora/exec-graph/backend/internal/application/publicprofile"
	applicationreview "github.com/singaurora/exec-graph/backend/internal/application/review"
	applicationworkoverview "github.com/singaurora/exec-graph/backend/internal/application/workoverview"
	bootstrapconfig "github.com/singaurora/exec-graph/backend/internal/bootstrap/config"
	httpendpoint "github.com/singaurora/exec-graph/backend/internal/http/endpoint"
	httpapirouter "github.com/singaurora/exec-graph/backend/internal/http/router"
	infrastructureai "github.com/singaurora/exec-graph/backend/internal/infrastructure/ai"
	infrastructuremail "github.com/singaurora/exec-graph/backend/internal/infrastructure/mail"
	infrastructuremedia "github.com/singaurora/exec-graph/backend/internal/infrastructure/media"
	aikeypersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/aikey"
	collaborationpersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/collaboration"
	contractpersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/contract"
	conversationpersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/conversation"
	executionpersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/execution"
	identitypersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/identity"
	persistencemysql "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/mysql"
	networkpersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/network"
	projectpersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/project"
	publicprofilepersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/publicprofile"
	reviewpersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/review"
	workoverviewpersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/workoverview"
	infrastructureredis "github.com/singaurora/exec-graph/backend/internal/infrastructure/redis"
	infrastructuresecurity "github.com/singaurora/exec-graph/backend/internal/infrastructure/security"
	infrastructurestorage "github.com/singaurora/exec-graph/backend/internal/infrastructure/storage"
	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
)

// Run assembles the application dependencies and starts the HTTP server.
func Run() error {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)
	configPath := os.Getenv("EXEC_GRAPH_CONFIG")
	if configPath == "" {
		configPath = "etc/config.local.yaml"
	}
	config, err := bootstrapconfig.Load(configPath)
	if err != nil {
		return fmt.Errorf("load config: %w", err)
	}

	orm, err := persistencemysql.Open(config.Database)
	if err != nil {
		return fmt.Errorf("open database: %w", err)
	}
	defer persistencemysql.Close(orm)

	mailer, err := infrastructuremail.NewTencentSES(config.Mail, config.Credentials)
	if err != nil {
		return fmt.Errorf("create mailer: %w", err)
	}
	storage, err := infrastructurestorage.NewTencentCOS(config.Storage, config.Credentials)
	if err != nil {
		return fmt.Errorf("create object storage: %w", err)
	}
	redisStore, err := infrastructureredis.NewSessionStore(config.Redis)
	if err != nil {
		return fmt.Errorf("connect Redis session store: %w", err)
	}
	logger.Info("Redis session store connected", "host", config.Redis.Host, "port", config.Redis.Port)
	defer func() {
		_ = redisStore.Close()
	}()

	// bootstrap 是唯一的组合根：创建基础设施、仓储和 application service，
	// 再把已组装的依赖交给 HTTP 层。
	identityStore := identitypersistence.NewIdentityRepository(orm)
	aiKeyStore := aikeypersistence.NewAIKeyRepository(orm)
	contractStore := contractpersistence.NewSmartContractRepository(orm)
	executionStore := executionpersistence.NewRepository(orm)
	collaborationStore := collaborationpersistence.NewRepository(orm)
	conversationStore := conversationpersistence.NewRepository(orm)
	workOverviewStore := workoverviewpersistence.NewRepository(orm)
	passwordHasher := infrastructuresecurity.PasswordHasher{}
	credentialCipher, err := infrastructuresecurity.NewCredentialCipher(config.Security.CredentialEncryptionKey)
	if err != nil {
		return fmt.Errorf("create credential cipher: %w", err)
	}
	aiProviderClient := infrastructureai.NewProviderClient()

	identityService := applicationidentity.New(applicationidentity.Dependencies{
		Repository: identityStore,
		Contracts:  contractStore,
		Mailer:     mailer,
		Sessions:   redisStore,
		Passwords:  passwordHasher,
		Storage:    storage,
		Images:     infrastructuremedia.ProfileImageProcessor{},
		CodeTTL:    time.Duration(config.Mail.CodeTTLMinutes) * time.Minute,
		SessionTTL: time.Duration(config.App.SessionTTLHours) * time.Hour,
	})
	projectStore := projectpersistence.NewProjectRepository(orm)
	projectService := applicationproject.New(
		projectpersistence.NewApplicationRepository(projectStore),
		contractpersistence.NewApplicationRepository(contractStore),
		executionpersistence.NewApplicationRepository(executionStore),
	)
	networkService := applicationnetwork.New(networkpersistence.NewRepository(orm))
	publicProfileService := applicationpublicprofile.New(applicationpublicprofile.Dependencies{
		Repository: publicprofilepersistence.NewRepository(orm),
		Storage:    storage,
	})
	aiKeyService := applicationaikey.New(applicationaikey.Dependencies{
		Repository: aiKeyStore,
		Cipher:     credentialCipher,
		Verifier:   aiProviderClient,
	})
	reviewService := applicationreview.New(applicationreview.Dependencies{
		ModelClient: aiProviderClient,
		Repository:  reviewpersistence.NewRepository(orm),
		Credentials: aiKeyService,
	})
	collaborationService := applicationcollaboration.New(applicationcollaboration.Dependencies{
		Repository:  collaborationpersistence.NewApplicationRepository(collaborationStore),
		Credentials: aiKeyService,
		Reviewer:    reviewService,
	})
	conversationService := applicationconversation.New(applicationconversation.Dependencies{
		Repository:          conversationStore,
		Credentials:         aiKeyService,
		ContributionOrigins: projectService,
		ModelClient:         aiProviderClient,
		Reviewer:            reviewService,
	})
	workOverviewService := applicationworkoverview.New(applicationworkoverview.Dependencies{
		Repository:  workOverviewStore,
		Credentials: aiKeyService,
		ModelClient: aiProviderClient,
	})

	apiServer := httpendpoint.NewServer(httpendpoint.Dependencies{
		Workflow: httpendpoint.WorkflowDependencies{
			Reviewer: reviewService,
		},
		Conversation:  conversationService,
		WorkOverview:  workOverviewService,
		Identity:      identityService,
		Project:       projectService,
		Network:       networkService,
		PublicProfile: publicProfileService,
		AIKey:         aiKeyService,
		Collaboration: collaborationService,
	})
	address := fmt.Sprintf("%s:%d", config.App.Host, config.App.Port)
	server := &http.Server{
		Addr: address,
		Handler: httpapirouter.New(apiServer.Endpoints(), httpapirouter.Config{
			AllowedOrigins: config.App.AllowedOrigins,
			Logger:         logger,
		}),
		ReadHeaderTimeout: sharedconstants.HTTPReadHeaderTimeout,
		ReadTimeout:       sharedconstants.HTTPReadTimeout,
		WriteTimeout:      sharedconstants.HTTPWriteTimeout,
		IdleTimeout:       sharedconstants.HTTPIdleTimeout,
	}

	serverErrors := make(chan error, 1)
	go func() {
		logger.Info("exec_graph backend listening", "address", address)
		serverErrors <- server.ListenAndServe()
	}()

	signalContext, stopSignals := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stopSignals()
	select {
	case err := <-serverErrors:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return fmt.Errorf("serve HTTP: %w", err)
	case <-signalContext.Done():
		logger.Info("shutdown signal received")
	}

	shutdownContext, cancelShutdown := context.WithTimeout(context.Background(), sharedconstants.HTTPShutdownTimeout)
	defer cancelShutdown()
	if err := server.Shutdown(shutdownContext); err != nil {
		return fmt.Errorf("shutdown HTTP server: %w", err)
	}
	if err := <-serverErrors; err != nil && !errors.Is(err, http.ErrServerClosed) {
		return fmt.Errorf("serve HTTP during shutdown: %w", err)
	}
	logger.Info("exec_graph backend stopped")
	return nil
}
