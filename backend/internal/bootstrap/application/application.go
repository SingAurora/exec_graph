package application

import (
	"fmt"
	"log"
	"net/http"
	"os"

	bootstrapconfig "github.com/singaurora/exec-graph/backend/internal/bootstrap/config"
	httpendpoint "github.com/singaurora/exec-graph/backend/internal/http/endpoint"
	httpapirouter "github.com/singaurora/exec-graph/backend/internal/http/router"
	infrastructuremail "github.com/singaurora/exec-graph/backend/internal/infrastructure/mail"
	persistencemysql "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/mysql"
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

	apiServer := httpendpoint.NewServer(httpendpoint.Dependencies{ORM: orm, Mailer: mailer, Storage: storage, Redis: redisStore, Config: config})
	address := fmt.Sprintf("%s:%d", config.App.Host, config.App.Port)
	log.Printf("exec_graph backend listening on %s", address)
	return (&http.Server{
		Addr:              address,
		Handler:           httpapirouter.New(apiServer.Endpoints()),
		ReadHeaderTimeout: sharedconstants.HTTPReadHeaderTimeout,
	}).ListenAndServe()
}
