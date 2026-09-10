package app

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
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

	db, err := openDatabase(config.Database)
	if err != nil {
		return fmt.Errorf("open database: %w", err)
	}
	defer db.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
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

	mailer, err := newMailer(config.Tencent.SES)
	if err != nil {
		return fmt.Errorf("create mailer: %w", err)
	}
	storage, err := newCOSStorage(config.Tencent.COS, config.Tencent.SES)
	if err != nil {
		return fmt.Errorf("create object storage: %w", err)
	}
	redisStore, err := newRedisStore(config.Redis)
	if err != nil {
		log.Printf("Redis unavailable; using MySQL sessions only: %v", err)
	} else if redisStore != nil {
		log.Printf("Redis session cache connected to %s:%d", config.Redis.Host, config.Redis.Port)
	}
	defer func() {
		if redisStore != nil {
			_ = redisStore.close()
		}
	}()

	server := &server{db: db, mailer: mailer, storage: storage, redis: redisStore, config: config}
	address := fmt.Sprintf("%s:%d", config.App.Host, config.App.Port)
	log.Printf("exec_graph backend listening on %s", address)
	return (&http.Server{
		Addr:              address,
		Handler:           server.routes(),
		ReadHeaderTimeout: 10 * time.Second,
	}).ListenAndServe()
}
