package application

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	applicationaikey "github.com/singaurora/exec-graph/backend/internal/application/aikey"
	applicationcollaboration "github.com/singaurora/exec-graph/backend/internal/application/collaboration"
	applicationconversation "github.com/singaurora/exec-graph/backend/internal/application/conversation"
	applicationidentity "github.com/singaurora/exec-graph/backend/internal/application/identity"
	applicationnetwork "github.com/singaurora/exec-graph/backend/internal/application/network"
	applicationproject "github.com/singaurora/exec-graph/backend/internal/application/project"
	bootstrapconfig "github.com/singaurora/exec-graph/backend/internal/bootstrap/config"
	httpendpoint "github.com/singaurora/exec-graph/backend/internal/http/endpoint"
	httpapirouter "github.com/singaurora/exec-graph/backend/internal/http/router"
	infrastructuremail "github.com/singaurora/exec-graph/backend/internal/infrastructure/mail"
	aikeypersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/aikey"
	collaborationpersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/collaboration"
	contractpersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/contract"
	conversationpersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/conversation"
	executionpersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/execution"
	identitypersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/identity"
	persistencemysql "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/mysql"
	networkpersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/network"
	projectpersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/project"
	reviewpersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/review"
	workoverviewpersistence "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/workoverview"
	infrastructureredis "github.com/singaurora/exec-graph/backend/internal/infrastructure/redis"
	infrastructurestorage "github.com/singaurora/exec-graph/backend/internal/infrastructure/storage"
	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
)

// Run assembles the application dependencies and starts the HTTP server.
func Run() error {
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
	log.Printf("Redis session store connected to %s:%d", config.Redis.Host, config.Redis.Port)
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

	identityService := applicationidentity.New(applicationidentity.Dependencies{
		Repository: identityStore,
		Contracts:  contractStore,
		Mailer:     mailer,
		Sessions:   redisStore,
		CodeTTL:    time.Duration(config.Mail.CodeTTLMinutes) * time.Minute,
		SessionTTL: time.Duration(config.App.SessionTTLHours) * time.Hour,
	})
	projectService := applicationproject.New(projectpersistence.NewProjectRepository(orm), contractStore, executionStore)
	networkService := applicationnetwork.New(networkpersistence.NewRepository(orm))
	aiKeyService := applicationaikey.New(aiKeyStore)
	collaborationService := applicationcollaboration.New(collaborationStore)

	apiServer := httpendpoint.NewServer(httpendpoint.Dependencies{
		Reviews:            reviewpersistence.NewRepository(orm),
		Conversations:      conversationStore,
		Conversation:       applicationconversation.New(conversationStore),
		CollaborationStore: collaborationStore,
		WorkOverview:       workoverviewpersistence.NewRepository(orm),
		Storage:            storage,
		Identity:           identityService,
		Project:            projectService,
		Network:            networkService,
		AIKey:              aiKeyService,
		Collaboration:      collaborationService,
	})
	address := fmt.Sprintf("%s:%d", config.App.Host, config.App.Port)
	log.Printf("exec_graph backend listening on %s", address)
	return (&http.Server{
		Addr:              address,
		Handler:           httpapirouter.New(apiServer.Endpoints()),
		ReadHeaderTimeout: sharedconstants.HTTPReadHeaderTimeout,
	}).ListenAndServe()
}
