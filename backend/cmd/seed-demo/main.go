package main

import (
	"log"

	"github.com/singaurora/exec-graph/backend/internal/app"
)

func main() {
	if err := app.SeedDemoData(); err != nil {
		log.Fatal(err)
	}
	log.Println("ExecG demo collaboration data is ready")
}
