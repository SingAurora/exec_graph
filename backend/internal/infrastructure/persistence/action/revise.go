package action

import (
	"time"

	app "github.com/singaurora/exec-graph/backend/internal/application/action"
	"github.com/singaurora/exec-graph/backend/internal/infrastructure/persistence/model"
	"github.com/singaurora/exec-graph/backend/internal/shared/id"
)

func (t *actionTransaction) Revise(r app.Revision) error {
	now, uuid := time.Now().UTC(), id.New()
	text := ""
	if r.Document.Markdown != nil {
		text = *r.Document.Markdown
	}
	doc := model.DocumentVersion{UUID: uuid, GraphUUID: r.GraphID, NodeUUID: r.NodeID, Kind: r.Kind, RevisionNumber: r.Number, Mode: r.Document.Mode, ChangeKind: r.ChangeKind, Markdown: text, ActorUUID: r.ActorID, GenerationUUID: pointer(r.GenerationID), PreviousVersionUUID: pointer(r.Previous.ID), CreatedAt: now}
	if err := t.DB.Create(&doc).Error; err != nil {
		return err
	}
	if err := t.DB.Model(&model.DocumentState{}).Where("node_uuid = ? AND kind = ?", r.NodeID, r.Kind).Updates(model.DocumentState{Mode: r.Document.Mode, LocalVersionUUID: &uuid, EffectiveVersionUUID: &uuid, UpdatedAt: now}).Error; err != nil {
		return err
	}
	return t.DB.Model(&model.ActionNode{}).Where("uuid = ?", r.NodeID).Updates(model.ActionNode{Version: r.ExpectedVersion + 1, UpdatedAt: now}).Error
}
