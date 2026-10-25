package action

import (
	app "github.com/singaurora/exec-graph/backend/internal/application/action"
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
	for _, kind := range []string{"expression", "agreement"} {
		doc := p.Generation.Expression
		previous := ""
		if kind == "agreement" {
			doc = p.Generation.Agreement
		}
		if len(p.Sources) > 0 {
			if kind == "expression" {
				previous = p.Sources[0].ExpressionID
			} else {
				previous = p.Sources[0].AgreementID
			}
		}
		state := model.DocumentState{GraphUUID: p.GraphID, NodeUUID: p.ID, Kind: kind, Mode: doc.Mode, EffectiveVersionUUID: pointer(previous), UpdatedAt: p.CreatedAt}
		if doc.Mode != "inherit" {
			uuid := id.New()
			markdown, change := "", "initial"
			if doc.Markdown != nil {
				markdown = *doc.Markdown
			}
			if doc.Mode == "clear" {
				change = "clear"
			}
			version := model.DocumentVersion{UUID: uuid, GraphUUID: p.GraphID, NodeUUID: p.ID, Kind: kind, RevisionNumber: 1, Mode: doc.Mode, ChangeKind: change, Markdown: markdown, ActorUUID: p.ActorID, GenerationUUID: &p.Generation.ID, PreviousVersionUUID: pointer(previous), CreatedAt: p.CreatedAt}
			if err := t.DB.Create(&version).Error; err != nil {
				return err
			}
			state.LocalVersionUUID, state.EffectiveVersionUUID = &uuid, &uuid
		}
		if err := t.DB.Create(&state).Error; err != nil {
			return err
		}
	}
	for i, image := range p.Images {
		if err := t.DB.Create(&model.ActionImage{NodeUUID: p.ID, AssetUUID: &image.AssetID, Position: uint16(i + 1), AltText: image.Alt}).Error; err != nil {
			return err
		}
	}
	return nil
}
