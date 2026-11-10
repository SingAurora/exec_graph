package action

import (
	"time"

	app "github.com/singaurora/exec-graph/backend/internal/application/action"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/media"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
)

func (t *actionTransaction) Publish(p app.Publication) error {
	root := uint8(0)
	if len(p.Sources) == 0 {
		root = 1
	}
	node := model.ActionNode{UUID: p.ID, GraphUUID: p.GraphID, NodeNumber: p.Number, IsRoot: root, AuthorUUID: p.ActorID, Title: p.Generation.Title, ObjectiveMarkdown: p.Generation.Objective, ContextGuideSnapshot: p.Guide, HistoryNodeCount: p.HistoryCount, NodeLevel: p.Level, Version: 1, CreatedAt: p.CreatedAt, UpdatedAt: p.CreatedAt}
	if err := t.DB.Create(&node).Error; err != nil {
		return err
	}
	if err := t.DB.Model(&model.Graph{}).Where("uuid = ?", p.GraphID).Update("next_node_number", p.Number+1).Error; err != nil {
		return err
	}
	for _, source := range p.Sources {
		reason := source.ExceptionReason
		if source.AgreementStatus != "exception" {
			reason = nil
		}
		row := model.ActionReference{UUID: id.New(), GraphUUID: p.GraphID, SourceNodeUUID: source.NodeID, TargetNodeUUID: p.ID, Kind: source.Kind, SourceNodeVersion: source.Version, AgreementVersionUUID: pointer(source.AgreementID), AgreementStatus: source.AgreementStatus, ExceptionReason: reason, CreatedAt: p.CreatedAt}
		if err := t.DB.Create(&row).Error; err != nil {
			return err
		}
	}
	assetIDs := make([]string, 0, len(p.Images))
	for i, image := range p.Images {
		if err := t.DB.Create(&model.ActionImage{NodeUUID: p.ID, AssetUUID: &image.AssetID, Position: uint16(i + 1), AltText: image.Alt}).Error; err != nil {
			return err
		}
		assetIDs = append(assetIDs, image.AssetID)
	}
	return media.BindAssets(t.DB, p.ActorID, "action", p.ID, assetIDs)
}

// documentInheritanceTarget 是一种文档的继承目标；空版本表示该文档需要重新生成。
type documentInheritanceTarget struct{ kind, versionID string }

func documentInheritanceTargets(expressionVersionID, agreementVersionID string) []documentInheritanceTarget {
	return []documentInheritanceTarget{
		{"expression", expressionVersionID},
		{"agreement", agreementVersionID},
	}
}

// InitializeNodeDocuments 继承主要来源的已发布文档；表达和约定各自独立继承，
// 某一种没有可继承版本时只把该种创建为待生成，不能把另一种也重置。
func (t *actionTransaction) InitializeNodeDocuments(graphID, nodeID, expressionVersionID, agreementVersionID string) error {
	now := time.Now().UTC()
	for _, inherited := range documentInheritanceTargets(expressionVersionID, agreementVersionID) {
		if inherited.versionID == "" {
			row := model.NodeDocument{UUID: id.New(), GraphUUID: graphID, NodeUUID: nodeID, Kind: inherited.kind, Status: "pending", CreatedAt: now, UpdatedAt: now}
			if err := t.DB.Create(&row).Error; err != nil {
				return err
			}
			continue
		}
		state := model.DocumentState{GraphUUID: graphID, NodeUUID: nodeID, Kind: inherited.kind, Mode: "inherit", EffectiveVersionUUID: &inherited.versionID, UpdatedAt: now}
		if err := t.DB.Create(&state).Error; err != nil {
			return err
		}
		row := model.NodeDocument{UUID: id.New(), GraphUUID: graphID, NodeUUID: nodeID, Kind: inherited.kind, Status: "published", PublishedVersion: &inherited.versionID, CreatedAt: now, UpdatedAt: now}
		if err := t.DB.Create(&row).Error; err != nil {
			return err
		}
	}
	return nil
}
