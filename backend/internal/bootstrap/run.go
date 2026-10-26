package bootstrap

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/schema"
)

// Run 验证 schema 后启动业务进程，退出时依次关闭 HTTP 和外部连接。
func Run() error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	deps, err := Open(ctx, true)
	if err != nil {
		return err
	}
	defer deps.Close()
	deps.Frontend, err = frontendFiles(deps.Config.App.FrontendDir)
	if err != nil {
		return err
	}
	if err := schema.Check(ctx, deps.DB); err != nil {
		return err
	}
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	maintenanceCtx, endMaintenance := context.WithCancel(ctx)
	maintenanceDone := make(chan struct{})
	go func() { defer close(maintenanceDone); maintainMedia(maintenanceCtx, deps, logger) }()
	defer func() { endMaintenance(); <-maintenanceDone }()
	servers, err := webServers(deps.Config.App, HTTP(deps, logger))
	if err != nil {
		return err
	}
	return serveWeb(ctx, servers, logger)
}
