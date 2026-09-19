package main

import (
	"log"

	application "github.com/singaurora/exec-graph/backend/internal/bootstrap/application"
)

func main() {
	if err := application.Run(); err != nil {
		log.Fatal(err)
	}
}
