package schema

import (
	"context"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/singaurora/exec-graph/backend/internal/bootstrap/config"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/database"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
)

func TestMySQLMigrationAndConstraints(t *testing.T) {
	if os.Getenv("EXEC_GRAPH_INTEGRATION") != "1" {
		t.Skip("显式启用后才连接真实 MySQL")
	}
	c, err := config.Load(config.Path())
	if err != nil {
		t.Fatal(err)
	}
	c.Database.Schema = "eg_it_" + strings.ReplaceAll(id.New(), "-", "")
	if err := database.CreateSchema(c.Database); err != nil {
		t.Fatal(err)
	}
	db, err := database.Open(c.Database)
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close(db)
	// 仅清除此测试刚创建的随机隔离库，不使用旧配置的 schema。
	defer func() {
		if err := db.Exec("DROP DATABASE `" + c.Database.Schema + "`").Error; err != nil {
			t.Error(err)
		}
	}()
	ctx := context.Background()
	if err := Migrate(ctx, db); err != nil {
		t.Fatal(err)
	}
	if err := Migrate(ctx, db); err != nil {
		t.Fatalf("重复迁移失败: %v", err)
	}
	var versions int64
	if err := db.Model(&model.SchemaVersion{}).Count(&versions).Error; err != nil || versions != 1 {
		t.Fatalf("迁移记录不正确: %d %v", versions, err)
	}
	ordinary := model.User{UUID: id.New(), Name: "普通账号", Gender: "unknown", BiographyMarkdown: "", Version: 1}
	dataset := "integration"
	demo := model.User{UUID: id.New(), Name: "演示账号", Gender: "unknown", BiographyMarkdown: "", Version: 1, IsTestAccount: true, TestDataset: &dataset}
	if err := db.Create(&ordinary).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&demo).Error; err != nil {
		t.Fatal(err)
	}
	duplicate := ordinary
	duplicate.ID = 0
	if err := db.Create(&duplicate).Error; err == nil {
		t.Fatal("重复公开 UUID 没有被拒绝")
	}
	var loaded model.User
	if err := db.Where("uuid = ?", demo.UUID).Take(&loaded).Error; err != nil || !loaded.IsTestAccount || loaded.TestDataset == nil {
		t.Fatalf("测试账号标记未持久化: %v", err)
	}
	graph := model.Graph{UUID: id.New(), OwnerUUID: demo.UUID, Title: "约束验证", Description: "", ContextGuide: "", NextNodeNumber: 4, Version: 1}
	if err := db.Create(&graph).Error; err != nil {
		t.Fatal(err)
	}
	nodes := []model.ActionNode{}
	for n := uint32(1); n <= 3; n++ {
		node := model.ActionNode{UUID: id.New(), GraphUUID: graph.UUID, NodeNumber: n, AuthorUUID: demo.UUID, Title: "行动", ObjectiveMarkdown: "实际发生的事", ContextGuideSnapshot: "", NodeLevel: n, HistoryNodeCount: n - 1, Version: 1, CreatedAt: time.Now().UTC()}
		if n == 1 {
			node.IsRoot = 1
		}
		if err := db.Create(&node).Error; err != nil {
			t.Fatal(err)
		}
		nodes = append(nodes, node)
	}
	badRoot := nodes[0]
	badRoot.ID = 0
	badRoot.UUID = id.New()
	if err := db.Create(&badRoot).Error; err == nil {
		t.Fatal("重复起点没有被拒绝")
	}
	edge := model.ActionReference{UUID: id.New(), GraphUUID: graph.UUID, SourceNodeUUID: nodes[0].UUID, TargetNodeUUID: nodes[2].UUID, Kind: "primary", SourceNodeVersion: 1, AgreementStatus: "unrestricted"}
	if err := db.Create(&edge).Error; err != nil {
		t.Fatal(err)
	}
	edge.ID = 0
	edge.UUID = id.New()
	edge.SourceNodeUUID = nodes[1].UUID
	if err := db.Create(&edge).Error; err == nil {
		t.Fatal("同一目标的第二条主要来源没有被拒绝")
	}
	edge.ID = 0
	edge.UUID = id.New()
	edge.Kind = "merged"
	if err := db.Create(&edge).Error; err != nil {
		t.Fatalf("合入来源应允许: %v", err)
	}
	if err := db.Create(&model.ProfileHighlight{UserUUID: demo.UUID, NodeUUID: nodes[0].UUID, Position: 6}).Error; err == nil {
		t.Fatal("第六个精选没有被拒绝")
	}
	if err := Check(ctx, db); err != nil {
		t.Fatal(err)
	}
	if err := db.Migrator().DropTable(&model.SchemaVersion{}); err != nil {
		t.Fatal(err)
	}
	if err := Migrate(ctx, db); err == nil {
		t.Fatal("没有迁移记录的旧业务表被错误接管")
	}
}
