// demo-seed explicitly loads public collaboration fixtures into a database.
// It is never invoked by the API process.
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"

	bootstrapconfig "github.com/singaurora/exec-graph/backend/internal/bootstrap/config"
	infrastructuredemo "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/demo"
	persistencemysql "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/mysql"
	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
)

func main() {
	allow := flag.Bool("allow", false, "确认写入演示测试数据")
	flag.Parse()
	if !*allow || os.Getenv("EXEC_GRAPH_ALLOW_DEMO_SEED") != "1" {
		log.Fatal("demo seed disabled; use -allow and EXEC_GRAPH_ALLOW_DEMO_SEED=1")
	}
	demoPassword := os.Getenv("EXEC_GRAPH_DEMO_PASSWORD")
	if demoPassword == "" {
		log.Fatal("demo seed requires EXEC_GRAPH_DEMO_PASSWORD")
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
	ctx, cancel := context.WithTimeout(context.Background(), sharedconstants.DemoSeedTimeout)
	defer cancel()
	if err := infrastructuredemo.Seed(ctx, database, demoPassword); err != nil {
		log.Fatal(err)
	}
	fmt.Println("demo data is ready; accounts are marked as test accounts")
}
