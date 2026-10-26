// Package action 实现行动发布与文档确认的 GORM 事务仓储。
package action

import (
	"context"
	"errors"

	app "github.com/singaurora/exec-graph/backend/internal/application/action"
	"github.com/singaurora/exec-graph/backend/internal/application/catalogue"
	"github.com/singaurora/exec-graph/backend/internal/application/identity"
	read "github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/catalogue"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/transaction"
	"github.com/singaurora/exec-graph/backend/internal/shared/fault"
	"gorm.io/gorm"
)

// Repository 使用组合根注入的数据库连接。
type Repository struct{ db *gorm.DB }

// New 创建行动仓储。
func New(db *gorm.DB) *Repository { return &Repository{db: db} }

type actionTransaction struct{ *transaction.Scope }

// InScope 为生成用例复用同一事务中的图读取与领域上下文映射。
func InScope(scope *transaction.Scope) app.Transaction { return &actionTransaction{scope} }

// Within 向行动用例提供认证锁及同一数据库事务。
func (r *Repository) Within(ctx context.Context, actor identity.Actor, run func(app.Transaction) error) error {
	return transaction.Within(ctx, r.db, actor, func(scope *transaction.Scope) error { return run(&actionTransaction{scope}) })
}

func (t *actionTransaction) NodeGraph(uuid string) (string, error) {
	var node model.ActionNode
	err := t.DB.Where("uuid = ?", uuid).Take(&node).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return "", fault.New(fault.NotFound, "行动不存在")
	}
	return node.GraphUUID, err
}

func (t *actionTransaction) Graph(uuid string) (app.Graph, error) {
	row, err := t.LockGraph(uuid)
	if err != nil {
		return app.Graph{}, err
	}
	graph := app.Graph{ID: uuid, Guide: row.ContextGuide, NextNumber: row.NextNodeNumber}
	var nodes []model.ActionNode
	var edges []model.ActionReference
	var states []model.DocumentState
	if err := t.DB.Where("graph_uuid = ?", uuid).Find(&nodes).Error; err != nil {
		return graph, err
	}
	if err := t.DB.Where("graph_uuid = ?", uuid).Find(&edges).Error; err != nil {
		return graph, err
	}
	if err := t.DB.Where("graph_uuid = ?", uuid).Find(&states).Error; err != nil {
		return graph, err
	}
	docIDs := []string{}
	for _, state := range states {
		if state.EffectiveVersionUUID != nil {
			docIDs = append(docIDs, *state.EffectiveVersionUUID)
		}
	}
	var documents []model.DocumentVersion
	if len(docIDs) > 0 {
		if err := t.DB.Where("uuid IN ?", docIDs).Find(&documents).Error; err != nil {
			return graph, err
		}
	}
	byDocument := map[string]model.DocumentVersion{}
	for _, doc := range documents {
		byDocument[doc.UUID] = doc
	}
	byNode := map[string]map[string]app.Document{}
	for _, state := range states {
		if byNode[state.NodeUUID] == nil {
			byNode[state.NodeUUID] = map[string]app.Document{}
		}
		doc := app.Document{}
		if state.EffectiveVersionUUID != nil {
			version, ok := byDocument[*state.EffectiveVersionUUID]
			if !ok || version.GraphUUID != uuid || version.Kind != state.Kind {
				return graph, fault.New(fault.Unavailable, "行动文档数据不完整")
			}
			doc = app.Document{ID: version.UUID, NodeID: version.NodeUUID, ActorID: version.ActorUUID, Mode: version.Mode, Markdown: version.Markdown, Revision: version.RevisionNumber}
		}
		byNode[state.NodeUUID][state.Kind] = doc
	}
	for _, node := range nodes {
		if len(byNode[node.UUID]) != 2 {
			return graph, fault.New(fault.Unavailable, "行动文档状态不完整")
		}
		graph.Nodes = append(graph.Nodes, app.Node{ID: node.UUID, AuthorID: node.AuthorUUID, Version: node.Version, Number: node.NodeNumber, Level: node.NodeLevel, Expression: byNode[node.UUID]["expression"], Agreement: byNode[node.UUID]["agreement"]})
	}
	for _, edge := range edges {
		graph.Edges = append(graph.Edges, app.Edge{SourceID: edge.SourceNodeUUID, TargetID: edge.TargetNodeUUID, Kind: edge.Kind})
	}
	return graph, nil
}

func (t *actionTransaction) View(uuid string) (catalogue.ActionView, error) {
	return read.New(t.DB).Action(t.DB.Statement.Context, uuid)
}

func pointer(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}
