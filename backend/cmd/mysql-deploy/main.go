// mysql-deploy executes a reviewed SQL deployment file explicitly. It is not
// linked into API startup, so schema changes cannot occur as a side effect of
// serving traffic.
package main

import (
	"context"
	"database/sql"
	"flag"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql"
	bootstrapconfig "github.com/singaurora/exec-graph/backend/internal/bootstrap/config"
)

func main() {
	file := flag.String("file", "", "要执行的 SQL 文件")
	apply := flag.Bool("apply", false, "确认执行 SQL")
	start := flag.Int("start", 1, "从第几个 SQL 语句开始执行")
	flag.Parse()
	if strings.TrimSpace(*file) == "" || !*apply {
		log.Fatal("usage: go run ./cmd/mysql-deploy -file <sql-file> -apply")
	}
	config, err := bootstrapconfig.Load("etc/config.local.yaml")
	if err != nil {
		log.Fatal(err)
	}
	content, err := os.ReadFile(*file)
	if err != nil {
		log.Fatal(err)
	}
	if strings.Contains(strings.ToUpper(string(content)), "DELIMITER") {
		log.Fatal("该部署工具不执行包含 DELIMITER 的存储过程脚本；请使用 MySQL 客户端执行该文件")
	}
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=%s&parseTime=True&loc=Local", config.Database.User, config.Database.Password, config.Database.Host, config.Database.Port, config.Database.Name, config.Database.Charset)
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		log.Fatal(err)
	}
	if *start < 1 {
		log.Fatal("start must be at least 1")
	}
	for index, statement := range splitStatements(string(content)) {
		if index+1 < *start {
			continue
		}
		if strings.HasPrefix(strings.ToUpper(statement), "SELECT") {
			rows, err := db.QueryContext(ctx, statement)
			if err != nil {
				log.Fatalf("statement %d failed: %v\n%s", index+1, err, statement)
			}
			columns, err := rows.Columns()
			if err != nil {
				rows.Close()
				log.Fatal(err)
			}
			for rows.Next() {
				values := make([]any, len(columns))
				pointers := make([]any, len(columns))
				for i := range values {
					pointers[i] = &values[i]
				}
				if err := rows.Scan(pointers...); err != nil {
					rows.Close()
					log.Fatal(err)
				}
				log.Printf("statement %d result: %v", index+1, values)
			}
			if err := rows.Close(); err != nil {
				log.Fatal(err)
			}
			continue
		}
		if _, err := db.ExecContext(ctx, statement); err != nil {
			log.Fatalf("statement %d failed: %v\n%s", index+1, err, statement)
		}
		log.Printf("statement %d applied", index+1)
	}
}

func splitStatements(script string) []string {
	withoutComments := make([]string, 0, len(script))
	for _, line := range strings.Split(script, "\n") {
		if !strings.HasPrefix(strings.TrimSpace(line), "--") {
			withoutComments = append(withoutComments, line)
		}
	}
	parts := strings.Split(strings.Join(withoutComments, "\n"), ";")
	statements := make([]string, 0, len(parts))
	for _, part := range parts {
		if statement := strings.TrimSpace(part); statement != "" {
			statements = append(statements, statement)
		}
	}
	return statements
}
