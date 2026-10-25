// Command manage 运行显式数据库管理任务，不在 API 请求中迁移。
package main

import (
	"context"
	"flag"
	"fmt"
	"github.com/singaurora/exec-graph/backend/internal/bootstrap"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/schema"
	"os"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run() error {
	if len(os.Args) < 2 {
		return fmt.Errorf("用法: manage check|migrate|verify [--create-database]")
	}
	command := os.Args[1]
	flags := flag.NewFlagSet(command, flag.ContinueOnError)
	create := flags.Bool("create-database", false, "显式创建目标数据库，仅用于 migrate")
	if err := flags.Parse(os.Args[2:]); err != nil {
		return err
	}
	if flags.NArg() != 0 {
		return fmt.Errorf("不支持额外位置参数")
	}
	if command != "check" && command != "migrate" && command != "verify" {
		return fmt.Errorf("未知管理命令")
	}
	if *create {
		if command != "migrate" {
			return fmt.Errorf("只有 migrate 可以创建数据库")
		}
		if err := bootstrap.PrepareDatabase(); err != nil {
			return err
		}
	}
	ctx := context.Background()
	deps, err := bootstrap.Open(ctx, command == "check")
	if err != nil {
		return err
	}
	defer deps.Close()
	switch command {
	case "check":
		fmt.Println("MySQL 与 Redis 连接可用；未修改表或清空数据")
	case "migrate":
		if err := schema.Migrate(ctx, deps.DB); err != nil {
			return err
		}
		fmt.Println("GORM 迁移完成；UUID 逻辑关联，无数据库外键")
	case "verify":
		if err := schema.Check(ctx, deps.DB); err != nil {
			return err
		}
		fmt.Println("数据库版本、模型表与无外键检查通过")
	}
	return nil
}
