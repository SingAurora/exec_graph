package app

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"

	infrastructuremail "github.com/singaurora/exec-graph/backend/internal/infrastructure/mail"
	infrastructureredis "github.com/singaurora/exec-graph/backend/internal/infrastructure/redis"
	infrastructurestorage "github.com/singaurora/exec-graph/backend/internal/infrastructure/storage"
	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
)

// Run assembles the application dependencies and starts the HTTP server.
func Run() error {
	configPath := os.Getenv("EXEC_GRAPH_CONFIG")
	if configPath == "" {
		configPath = "config.local.yaml"
	}
	config, err := loadConfig(configPath)
	if err != nil {
		return fmt.Errorf("load config: %w", err)
	}

	orm, err := openDatabase(config.Database)
	if err != nil {
		return fmt.Errorf("open database: %w", err)
	}
	db, err := orm.DB()
	if err != nil {
		return fmt.Errorf("get database connection: %w", err)
	}
	defer db.Close()

	ctx, cancel := context.WithTimeout(context.Background(), sharedconstants.StartupInitializationTimeout)
	defer cancel()
	if err := migrateDatabase(ctx, db); err != nil {
		return fmt.Errorf("migrate database: %w", err)
	}
	if err := seedSystemData(ctx, db); err != nil {
		return fmt.Errorf("seed system data: %w", err)
	}
	if err := seedDevelopmentTestAccount(ctx, db, config.Development.TestAccount); err != nil {
		return fmt.Errorf("seed development test account: %w", err)
	}

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

	server := &server{db: db, orm: orm, mailer: mailer, storage: storage, redis: redisStore, config: config}
	address := fmt.Sprintf("%s:%d", config.App.Host, config.App.Port)
	log.Printf("exec_graph backend listening on %s", address)
	return (&http.Server{
		Addr:              address,
		Handler:           server.routes(),
		ReadHeaderTimeout: sharedconstants.HTTPReadHeaderTimeout,
	}).ListenAndServe()
}
