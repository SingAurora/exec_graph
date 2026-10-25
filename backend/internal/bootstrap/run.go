package bootstrap

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"

	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/schema"
	"github.com/singaurora/exec-graph/backend/internal/shared/constants"
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
	if err := schema.Check(ctx, deps.DB); err != nil {
		return err
	}
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	server := &http.Server{Addr: net.JoinHostPort(deps.Config.App.Host, strconv.Itoa(deps.Config.App.Port)), Handler: HTTP(deps, logger), ReadHeaderTimeout: constants.HTTPHeaderTimeout, ReadTimeout: constants.HTTPRequestTimeout, WriteTimeout: constants.HTTPRequestTimeout, IdleTimeout: constants.HTTPRequestTimeout}
	failures := make(chan error, 1)
	go func() { logger.Info("引序后端启动", "address", server.Addr); failures <- server.ListenAndServe() }()
	select {
	case err := <-failures:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return fmt.Errorf("启动 HTTP: %w", err)
	case <-ctx.Done():
	}
	shutdown, cancel := context.WithTimeout(context.Background(), constants.ShutdownTimeout)
	defer cancel()
	if err := server.Shutdown(shutdown); err != nil {
		_ = server.Close()
		return err
	}
	return nil
}
