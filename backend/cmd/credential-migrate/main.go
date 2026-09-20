// credential-migrate performs the reviewed one-time conversion from legacy
// plaintext credentials to bcrypt and AES-256-GCM protected values.
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"time"

	bootstrapconfig "github.com/singaurora/exec-graph/backend/internal/bootstrap/config"
	credentialmigration "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/credentialmigration"
	persistencemysql "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/mysql"
	infrastructuresecurity "github.com/singaurora/exec-graph/backend/internal/infrastructure/security"
)

func main() {
	apply := flag.Bool("apply", false, "确认执行凭据迁移")
	flag.Parse()
	if !*apply {
		log.Fatal("usage: go run ./cmd/credential-migrate -apply")
	}
	configPath := os.Getenv("EXEC_GRAPH_CONFIG")
	if configPath == "" {
		configPath = "etc/config.local.yaml"
	}
	config, err := bootstrapconfig.Load(configPath)
	if err != nil {
		log.Fatal(err)
	}
	database, err := persistencemysql.Open(config.Database)
	if err != nil {
		log.Fatal(err)
	}
	defer persistencemysql.Close(database)
	cipher, err := infrastructuresecurity.NewCredentialCipher(config.Security.CredentialEncryptionKey)
	if err != nil {
		log.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
	defer cancel()
	report, err := credentialmigration.Apply(ctx, database, infrastructuresecurity.PasswordHasher{}, cipher)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("credential migration complete: passwords_hashed=%d ai_keys_encrypted=%d\n", report.PasswordsHashed, report.AIKeysEncrypted)
}
