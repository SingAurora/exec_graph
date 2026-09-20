package main

import (
	"log/slog"
	"os"

	application "github.com/singaurora/exec-graph/backend/internal/bootstrap/application"
)

func main() {
	if err := application.Run(); err != nil {
		slog.Error("backend stopped with error", "error", err)
		os.Exit(1)
	}
}
