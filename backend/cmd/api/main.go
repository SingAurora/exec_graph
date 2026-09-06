package main

import (
	"log"

	"github.com/singaurora/exec-graph/backend/internal/app"
)

func main() {
	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
